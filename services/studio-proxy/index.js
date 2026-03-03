import "../shared/env.js";
import { fileURLToPath } from "url";
import path from "path";
import readline from "readline";
import { MongoClient } from "mongodb";
import { createStudioProxy, isStartPrintCommand, defaultLog } from "./proxy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  STUDIO_PROXY_PORT = "28883",
  PROXY_HOST,
  BAMBU_CLOUD_HOST = "us.mqtt.bambulab.com",
  MONGODB_URI,
  DB_NAME = "tektonology",
} = process.env;

const REQUIRED = ["MONGODB_URI"];
for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

// --- MongoDB ---
const mongo = new MongoClient(MONGODB_URI);
await mongo.connect();
const db = mongo.db(DB_NAME);

// Ensure time series collection exists
const collections = await db.listCollections({ name: "studio_mqtt_log" }).toArray();
if (collections.length === 0) {
  await db.createCollection("studio_mqtt_log", {
    timeseries: {
      timeField: "timestamp",
      metaField: "meta",
      granularity: "seconds",
    },
  });
  console.log("Created time series collection: studio_mqtt_log");
}
const mqttLog = db.collection("studio_mqtt_log");
console.log(`Connected to MongoDB (${DB_NAME})`);

const DIRECTION_MAP = {
  "STUDIO → CLOUD": { sender: "studio", audience: "cloud" },
  "CLOUD → STUDIO": { sender: "cloud", audience: "studio" },
};

function parseTopic(topicStr) {
  const parts = topicStr.split("/");
  if (parts.length === 3 && parts[0] === "device") {
    return { device: parts[1], channel: parts[2] };
  }
  return { raw: topicStr };
}

function promptApprove(jobName) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`\nApprove print job "${jobName}"? [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

const proxy = createStudioProxy({
  port: parseInt(STUDIO_PROXY_PORT, 10),
  listenHost: PROXY_HOST,
  certPath: path.join(__dirname, "..", "print-proxy", "certs", "server.crt"),
  keyPath: path.join(__dirname, "..", "print-proxy", "certs", "server.key"),
  upstreamHost: BAMBU_CLOUD_HOST,
  onMessage({ direction, topic, payload }) {
    defaultLog({ direction, topic, payload });
    const { sender, audience } = DIRECTION_MAP[direction] ?? { sender: "unknown", audience: "unknown" };
    mqttLog.insertOne({
      meta: { sender, audience, topic: parseTopic(topic) },
      payload,
      timestamp: new Date(),
    }).catch((err) => console.error("[studio-proxy] MongoDB insert error:", err.message));
  },
  async onIntercept({ payload }) {
    if (!isStartPrintCommand(payload)) return true;
    const jobName = payload?.print?.subtask_name ?? payload?.print?.url ?? "unknown";
    console.log(`\n[studio-proxy] PRINT JOB DETECTED: "${jobName}"`);
    return promptApprove(jobName);
  },
});

await proxy.start();
