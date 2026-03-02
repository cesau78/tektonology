import "../shared/env.js";
import { fileURLToPath } from "url";
import path from "path";
import readline from "readline";
import { MongoClient } from "mongodb";
import { createProxy, isStartPrintCommand, defaultLog } from "./proxy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  PRINTER_SERIAL,
  PRINTER_ACCESS_CODE,
  PRINTER_IP,
  PROXY_PORT = "8883",
  PROXY_HOST,
  MONGODB_URI,
  DB_NAME = "tektonology",
} = process.env;

const REQUIRED = ["PRINTER_SERIAL", "PRINTER_ACCESS_CODE", "PRINTER_IP", "MONGODB_URI"];
for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

// --- MongoDB ---
const mongo = new MongoClient(MONGODB_URI);
await mongo.connect();
const db = mongo.db(DB_NAME);

// Ensure time series collection exists
const collections = await db.listCollections({ name: "printer_mqtt_log" }).toArray();
if (collections.length === 0) {
  await db.createCollection("printer_mqtt_log", {
    timeseries: {
      timeField: "timestamp",
      metaField: "meta",
      granularity: "seconds",
    },
  });
  console.log("Created time series collection: printer_mqtt_log");
}
const mqttLog = db.collection("printer_mqtt_log");
console.log(`Connected to MongoDB (${DB_NAME})`);

const DIRECTION_MAP = {
  "STUDIO → PRINTER": { sender: "studio", audience: "printer" },
  "PRINTER → STUDIO": { sender: "printer", audience: "studio" },
  "UNKNOWN":          { sender: "unknown", audience: "unknown" },
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

const proxy = createProxy({
  port: parseInt(PROXY_PORT, 10),
  listenHost: PROXY_HOST,
  certPath: path.join(__dirname, "certs", "server.crt"),
  keyPath: path.join(__dirname, "certs", "server.key"),
  accessCode: PRINTER_ACCESS_CODE,
  printerSerial: PRINTER_SERIAL,
  printerIp: PRINTER_IP,
  onMessage({ direction, topic, payload }) {
    defaultLog({ direction, topic, payload });
    const { sender, audience } = DIRECTION_MAP[direction] ?? DIRECTION_MAP.UNKNOWN;
    mqttLog.insertOne({
      meta: { sender, audience, topic: parseTopic(topic) },
      payload,
      timestamp: new Date(),
    }).catch((err) => console.error("[proxy] MongoDB insert error:", err.message));
  },
  async onIntercept({ payload }) {
    if (!isStartPrintCommand(payload)) return true;
    const jobName = payload?.print?.subtask_name ?? payload?.print?.url ?? "unknown";
    console.log(`\n[proxy] PRINT JOB DETECTED: "${jobName}"`);
    return promptApprove(jobName);
  },
});

await proxy.start();
