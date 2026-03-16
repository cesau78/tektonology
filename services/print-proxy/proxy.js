import fs from "fs";
import path from "path";
import tls from "tls";
import Aedes from "aedes";
import mqtt from "mqtt";

const noop = () => {};
const PRINT_COMMANDS = new Set(["project_file", "gcode_file", "print_3mf"]);

/**
 * Returns true if the parsed payload is a print-start command.
 */
export function isStartPrintCommand(payload) {
  if (typeof payload !== "object" || payload === null) return false;
  return PRINT_COMMANDS.has(payload?.print?.command);
}

/**
 * Create an MQTTS proxy that accepts Bambu Studio connections,
 * logs all MQTT traffic, and optionally relays to the real printer.
 *
 * When printerIp is provided, an upstream MQTT client connects to the
 * real printer.  Studio→Printer messages pass through onIntercept before
 * being forwarded.  Printer→Studio reports are injected back into Aedes.
 */
export function createProxy({ port, listenHost, certPath, keyPath, accessCode, printerSerial, printerIp, printerPort = 8883, onMessage, onIntercept }) {
  const log = onMessage ?? defaultLog;
  const intercept = onIntercept ?? (() => Promise.resolve(true));

  const aedes = new Aedes();
  const requestTopic = `device/${printerSerial}/request`;
  const reportTopic = `device/${printerSerial}/report`;

  // Authenticate — Bambu Studio connects as bblp:<access_code>
  aedes.authenticate = (_client, username, password, callback) => {
    const valid = username === "bblp" && String(password) === accessCode;
    if (valid) {
      callback(null, true);
    } else {
      const err = new Error("Bad credentials");
      err.returnCode = 4; // CONNACK bad username/password
      callback(err, false);
    }
  };

  // --- Upstream connection to the real printer ---
  let upstreamClient = null;

  if (printerIp) {
    upstreamClient = mqtt.connect(`mqtts://${printerIp}:${printerPort}`, {
      username: "bblp",
      password: accessCode,
      rejectUnauthorized: false,
      clientId: `print-proxy-upstream-${Date.now()}`,
    });

    upstreamClient.on("connect", () => {
      console.log(`[proxy] upstream connected to printer at ${printerIp}`);
      upstreamClient.subscribe(reportTopic, (err) => {
        if (err) console.error("[proxy] upstream subscribe error:", err);
      });
    });

    // Inject printer reports back into Aedes for Studio clients
    upstreamClient.on("message", (_topic, payload) => {
      aedes.publish({ topic: reportTopic, payload, qos: 0, retain: false }, noop);
    });

    upstreamClient.on("error", (err) => {
      if (err.code === 5) {
        console.error("[proxy] upstream auth failed — check PRINTER_ACCESS_CODE");
      } else {
        console.error(`[proxy] upstream error: ${err.message}`);
      }
    });
    upstreamClient.on("close", () => console.log("[proxy] upstream connection closed"));
  }

  // --- Log and relay published messages ---
  aedes.on("publish", async (packet, _client) => {
    if (packet.topic.startsWith("$SYS")) return;

    let direction;
    if (packet.topic === requestTopic) {
      direction = "STUDIO → PRINTER";
    } else if (packet.topic === reportTopic) {
      direction = "PRINTER → STUDIO";
    } else {
      direction = "UNKNOWN";
    }

    let payload;
    try {
      payload = JSON.parse(packet.payload.toString());
    } catch {
      payload = packet.payload.toString();
    }

    log({ direction, topic: packet.topic, payload });

    // Only relay Studio→Printer messages
    if (direction !== "STUDIO → PRINTER") return;

    const allowed = await intercept({ topic: packet.topic, payload });

    if (allowed && upstreamClient?.connected) {
      upstreamClient.publish(packet.topic, packet.payload, { qos: packet.qos });
    } else if (!allowed) {
      console.log("[proxy] job BLOCKED — not forwarded to printer");
    }
  });

  const tlsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  const server = tls.createServer(tlsOptions, aedes.handle);

  // --- Watch cert files for hot-reload ---
  let certWatcher = null;
  let reloadTimer = null;
  const certDir = path.dirname(certPath);

  function reloadCerts() {
    try {
      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(certPath);
      server.setSecureContext({ key, cert });
      console.log("[proxy] TLS certs reloaded");
    } catch (err) {
      console.error("[proxy] cert reload failed:", err.message);
    }
  }

  function startCertWatcher() {
    try {
      certWatcher = fs.watch(certDir, (_event, filename) => {
        const certBase = path.basename(certPath);
        const keyBase = path.basename(keyPath);
        /* c8 ignore next -- fs.watch on Windows may not report unrelated filenames reliably */
        if (filename !== certBase && filename !== keyBase) return;
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(reloadCerts, 500);
      });
    } catch {
      // cert dir may not exist yet in tests — watcher is optional
    }
  }

  return {
    start() {
      return new Promise((resolve) => {
        server.listen(port, listenHost ?? "0.0.0.0", () => {
          const host = listenHost ?? "localhost";
          console.log(`print-proxy listening on mqtts://${host}:${port}`);
          startCertWatcher();
          resolve();
        });
      });
    },
    stop() {
      clearTimeout(reloadTimer);
      if (certWatcher) certWatcher.close();
      return new Promise((resolve) => {
        aedes.close(() => {
          server.close(() => {
            if (upstreamClient) {
              upstreamClient.end(true, () => resolve());
            } else {
              resolve();
            }
          });
        });
      });
    },
    aedes,
    server,
    upstreamClient,
    reloadCerts,
  };
}

export function defaultLog({ direction, topic, payload }) {
  console.log(`\n[${direction}] ${topic}`);
  console.log(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}
