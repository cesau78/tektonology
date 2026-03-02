import "../shared/env.js";
import { fileURLToPath } from "url";
import path from "path";
import readline from "readline";
import { createProxy, isStartPrintCommand } from "./proxy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  PRINTER_SERIAL,
  PRINTER_ACCESS_CODE,
  PRINTER_IP,
  PROXY_PORT = "8883",
  PROXY_HOST,
} = process.env;

const REQUIRED = ["PRINTER_SERIAL", "PRINTER_ACCESS_CODE", "PRINTER_IP"];
for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
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
  async onIntercept({ payload }) {
    if (!isStartPrintCommand(payload)) return true;
    const jobName = payload?.print?.subtask_name ?? payload?.print?.url ?? "unknown";
    console.log(`\n[proxy] PRINT JOB DETECTED: "${jobName}"`);
    return promptApprove(jobName);
  },
});

await proxy.start();
