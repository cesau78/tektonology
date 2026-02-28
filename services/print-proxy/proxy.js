import fs from "fs";
import tls from "tls";
import Aedes from "aedes";

/**
 * Create an MQTTS proxy that accepts Bambu Studio connections,
 * logs all MQTT traffic, and (future) relays to the real printer.
 */
export function createProxy({ port, certPath, keyPath, accessCode, printerSerial, onMessage }) {
  const log = onMessage ?? defaultLog;

  const aedes = new Aedes();

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

  // Log all published messages
  aedes.on("publish", (packet, _client) => {
    // Skip internal aedes system topics ($SYS)
    if (packet.topic.startsWith("$SYS")) return;

    const requestTopic = `device/${printerSerial}/request`;
    const reportTopic = `device/${printerSerial}/report`;

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
  });

  const tlsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  const server = tls.createServer(tlsOptions, aedes.handle);

  return {
    start() {
      return new Promise((resolve) => {
        server.listen(port, () => {
          console.log(`print-proxy listening on mqtts://localhost:${port}`);
          resolve();
        });
      });
    },
    stop() {
      return new Promise((resolve) => {
        aedes.close(() => {
          server.close(() => resolve());
        });
      });
    },
    aedes,
    server,
  };
}

export function defaultLog({ direction, topic, payload }) {
  console.log(`\n[${direction}] ${topic}`);
  console.log(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}
