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
 * Create an MQTTS proxy that accepts Bambu Studio connections and relays
 * them to the Bambu cloud MQTT server.
 *
 * Auth is pass-through: the proxy accepts whatever credentials Studio sends
 * and uses them to connect upstream to the real cloud server.
 */
export function createStudioProxy({ port, listenHost, certPath, keyPath, upstreamHost, upstreamPort = 8883, onMessage, onIntercept }) {
  const log = onMessage ?? defaultLog;
  const intercept = onIntercept ?? (() => Promise.resolve(true));

  const aedes = new Aedes();

  // Store credentials from the first client that connects
  let storedCredentials = null;
  let upstreamClient = null;

  // Accept any credentials — store them for upstream connection
  aedes.authenticate = (_client, username, password, callback) => {
    storedCredentials = { username, password: String(password) };
    callback(null, true);
  };

  function connectUpstream() {
    if (upstreamClient || !upstreamHost || !storedCredentials) return;

    upstreamClient = mqtt.connect(`mqtts://${upstreamHost}:${upstreamPort}`, {
      username: storedCredentials.username,
      password: storedCredentials.password,
      rejectUnauthorized: false,
      clientId: `studio-proxy-upstream-${Date.now()}`,
    });

    upstreamClient.on("connect", () => {
      console.log(`[studio-proxy] upstream connected to ${upstreamHost}`);
      // Subscribe to all topics so we relay everything back
      upstreamClient.subscribe("#", (err) => {
        if (err) console.error("[studio-proxy] upstream subscribe error:", err);
      });
    });

    // Inject cloud responses back into Aedes for Studio clients
    upstreamClient.on("message", (topic, payload) => {
      aedes.publish({ topic, payload, qos: 0, retain: false }, noop);
    });

    upstreamClient.on("error", (err) => {
      if (err.code === 5) {
        console.error("[studio-proxy] upstream auth failed — check credentials");
      } else {
        console.error(`[studio-proxy] upstream error: ${err.message}`);
      }
    });

    upstreamClient.on("close", () => console.log("[studio-proxy] upstream connection closed"));
  }

  // Connect upstream when the first client arrives with credentials
  aedes.on("client", () => {
    connectUpstream();
  });

  // --- Log and relay published messages ---
  aedes.on("publish", async (packet, _client) => {
    if (packet.topic.startsWith("$SYS")) return;

    // Determine direction: messages from connected Studio clients go upstream,
    // messages injected by us (from upstream.on('message')) have no _client
    const direction = _client ? "STUDIO → CLOUD" : "CLOUD → STUDIO";

    let payload;
    try {
      payload = JSON.parse(packet.payload.toString());
    } catch {
      payload = packet.payload.toString();
    }

    log({ direction, topic: packet.topic, payload });

    // Only relay Studio→Cloud messages
    if (!_client) return;

    const allowed = await intercept({ topic: packet.topic, payload });

    if (allowed && upstreamClient?.connected) {
      upstreamClient.publish(packet.topic, packet.payload, { qos: packet.qos ?? 0 });
    } else if (!allowed) {
      console.log("[studio-proxy] message BLOCKED — not forwarded to cloud");
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
      console.log("[studio-proxy] TLS certs reloaded");
    } catch (err) {
      console.error("[studio-proxy] cert reload failed:", err.message);
    }
  }

  function startCertWatcher() {
    try {
      certWatcher = fs.watch(certDir, (_event, filename) => {
        if (filename !== path.basename(certPath) && filename !== path.basename(keyPath)) return;
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
          console.log(`studio-proxy listening on mqtts://${host}:${port}`);
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
    get upstreamClient() { return upstreamClient; },
    reloadCerts,
  };
}

export function defaultLog({ direction, topic, payload }) {
  console.log(`\n[${direction}] ${topic}`);
  console.log(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
}
