import "../shared/env.js";
import readline from "readline";
import { createProxy, isStartPrintCommand } from "./proxy.js";

const {
  PRINTER_SERIAL,
  PRINTER_ACCESS_CODE,
  PRINTER_IP,
  PROXY_PORT = "8883",
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
  certPath: new URL("./certs/server.crt", import.meta.url).pathname,
  keyPath: new URL("./certs/server.key", import.meta.url).pathname,
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
