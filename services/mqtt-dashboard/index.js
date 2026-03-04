import "../shared/env.js";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import { MongoClient } from "mongodb";
import { createTelemetryRouter } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  MONGODB_URI,
  DB_NAME = "tektonology",
  DASHBOARD_PORT = "3000",
} = process.env;

if (!MONGODB_URI) throw new Error("Missing env var: MONGODB_URI");

const mongo = new MongoClient(MONGODB_URI);
await mongo.connect();
const db = mongo.db(DB_NAME);
const mqttLog = db.collection("printer_mqtt_log");
console.log(`Connected to MongoDB (${DB_NAME})`);

const app = express();
app.use("/api", createTelemetryRouter(mqttLog));
app.use(express.static(path.join(__dirname, "public")));

app.listen(parseInt(DASHBOARD_PORT, 10), () => {
  console.log(`mqtt-dashboard running on http://localhost:${DASHBOARD_PORT}`);
});
