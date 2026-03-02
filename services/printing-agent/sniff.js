import "../shared/env.js";
import mqtt from "mqtt";

const { PRINTER_IP, PRINTER_SERIAL, PRINTER_ACCESS_CODE } = process.env;

for (const key of ["PRINTER_IP", "PRINTER_SERIAL", "PRINTER_ACCESS_CODE"]) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

const client = mqtt.connect(`mqtts://${PRINTER_IP}:8883`, {
  username: "bblp",
  password: PRINTER_ACCESS_CODE,
  rejectUnauthorized: false,
  clientId: `sniff-${Date.now()}`,
});

client.on("connect", () => {
  console.log(`Connected to printer at ${PRINTER_IP}`);
  client.subscribe(`device/${PRINTER_SERIAL}/report`, (err) => {
    if (err) console.error("Subscribe error:", err);
    else console.log("Listening for messages... (Ctrl+C to stop)\n");
  });
});

client.on("message", (_topic, payload) => {
  try {
    const msg = JSON.parse(payload.toString());
    console.log(JSON.stringify(msg, null, 2));
    console.log("---");
  } catch {
    console.log("(non-JSON)", payload.toString().slice(0, 200));
  }
});

client.on("error", (err) => console.error("MQTT error:", err));
