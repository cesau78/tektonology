import "dotenv/config";
import mqtt from "mqtt";
import readline from "readline";
import { MongoClient } from "mongodb";

const {
  PRINTER_IP,
  PRINTER_SERIAL,
  PRINTER_ACCESS_CODE,
  ACTIVE_SPOOL_ID,
  MONGODB_URI,
  DB_NAME = "tektonology",
} = process.env;

const REQUIRED = ["PRINTER_IP", "PRINTER_SERIAL", "PRINTER_ACCESS_CODE", "ACTIVE_SPOOL_ID", "MONGODB_URI"];
for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

// --- MongoDB ---
const mongo = new MongoClient(MONGODB_URI);
await mongo.connect();
const db = mongo.db(DB_NAME);
const printJobs = db.collection("print_jobs");
console.log(`Connected to MongoDB (${DB_NAME})`);

// --- MQTT ---
const REPORT_TOPIC = `device/${PRINTER_SERIAL}/report`;
let lastState = null;
let currentJob = null;

const client = mqtt.connect(`mqtts://${PRINTER_IP}:8883`, {
  username: "bblp",
  password: PRINTER_ACCESS_CODE,
  rejectUnauthorized: false, // Bambu uses a self-signed cert — expected
  clientId: `printing-agent-${Date.now()}`,
});

client.on("connect", () => {
  console.log(`Connected to printer at ${PRINTER_IP}`);
  client.subscribe(REPORT_TOPIC, (err) => {
    if (err) console.error("Subscribe error:", err);
    else console.log(`Subscribed to ${REPORT_TOPIC}`);
  });
});

client.on("message", async (_topic, payload) => {
  let msg;
  try {
    msg = JSON.parse(payload.toString());
  } catch {
    return;
  }

  const print = msg.print;
  if (!print) return;

  const state = print.gcode_state;
  if (!state || state === lastState) return;

  console.log(`Print state: ${lastState ?? "?"} → ${state}`);
  lastState = state;

  if (state === "running" && print.subtask_name) {
    currentJob = { project: print.subtask_name, startedAt: new Date().toISOString() };
    console.log(`Job started: "${currentJob.project}"`);
  }

  if (state === "finish") {
    const loggedAt = new Date().toISOString();
    const project = currentJob?.project ?? print.subtask_name ?? "Unknown";

    // Attempt to read grams from payload — field name varies by firmware.
    // On first finish, the full payload is logged so we can identify the field.
    let usageG = extractGrams(print);
    if (usageG == null) {
      console.log("Grams not found in payload. Raw print object:");
      console.log(JSON.stringify(print, null, 2));
      usageG = await promptGrams(project);
    }

    await logJob({ project, usageG, loggedAt });
    currentJob = null;
  }

  if (state === "failed") {
    console.log("Print failed — not logging.");
    currentJob = null;
  }
});

client.on("error", (err) => console.error("MQTT error:", err));
client.on("close", () => console.log("MQTT connection closed"));

/**
 * Attempt to extract grams from the print payload.
 * Bambu firmware versions report this differently; we check known field names.
 */
function extractGrams(print) {
  const candidates = ["filament_used_g", "mc_print_filament_g", "filament_g"];
  for (const field of candidates) {
    const val = print[field];
    if (typeof val === "number" && val > 0) return val;
    if (typeof val === "string" && parseFloat(val) > 0) return parseFloat(val);
  }
  return null;
}

/**
 * Fallback: ask the user to enter grams at the terminal.
 */
function promptGrams(project) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Enter grams used for "${project}": `, (answer) => {
      rl.close();
      resolve(parseFloat(answer) || 0);
    });
  });
}

/**
 * Write the raw print job to MongoDB.
 * bookkeeping-agent will pick it up and enrich it with cost + journal entries.
 */
async function logJob({ project, usageG, loggedAt }) {
  const doc = {
    project,
    spoolId: parseInt(ACTIVE_SPOOL_ID, 10),
    usageG,
    loggedAt,
    processed: false,
  };

  console.log("Writing print job:", doc);

  try {
    const result = await printJobs.insertOne(doc);
    console.log(`Print job recorded (id: ${result.insertedId})`);
  } catch (err) {
    console.error("Failed to write print job:", err.message);
  }
}
