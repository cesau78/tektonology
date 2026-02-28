import "dotenv/config";
import { createProxy } from "./proxy.js";

const {
  PRINTER_SERIAL,
  PRINTER_ACCESS_CODE,
  PROXY_PORT = "8883",
} = process.env;

const REQUIRED = ["PRINTER_SERIAL", "PRINTER_ACCESS_CODE"];
for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

const proxy = createProxy({
  port: parseInt(PROXY_PORT, 10),
  certPath: new URL("./certs/server.crt", import.meta.url).pathname,
  keyPath: new URL("./certs/server.key", import.meta.url).pathname,
  accessCode: PRINTER_ACCESS_CODE,
  printerSerial: PRINTER_SERIAL,
});

await proxy.start();
