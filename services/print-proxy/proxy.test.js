import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign, randomBytes } from "crypto";
import fs from "fs";
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "fs";
import os from "os";
import path from "path";
import tls from "tls";
import { fileURLToPath } from "url";
import Aedes from "aedes";
import mqtt from "mqtt";
import { createProxy, defaultLog, isStartPrintCommand } from "./proxy.js";

/**
 * Generate a self-signed cert+key pair using Node crypto (no openssl binary needed).
 */
function generateCert(dir) {
  mkdirSync(dir, { recursive: true });
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

  const notBefore = new Date();
  const notAfter = new Date(notBefore.getTime() + 24 * 60 * 60 * 1000);
  const serial = randomBytes(8);

  function derLength(len) {
    if (len < 128) return Buffer.from([len]);
    if (len < 256) return Buffer.from([0x81, len]);
    return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
  }
  function derSequence(...items) {
    const body = Buffer.concat(items);
    return Buffer.concat([Buffer.from([0x30]), derLength(body.length), body]);
  }
  function derSet(...items) {
    const body = Buffer.concat(items);
    return Buffer.concat([Buffer.from([0x31]), derLength(body.length), body]);
  }
  function derOid(oid) {
    const parts = oid.split(".").map(Number);
    const bytes = [40 * parts[0] + parts[1]];
    for (let i = 2; i < parts.length; i++) {
      let v = parts[i];
      if (v >= 128) {
        const enc = [];
        enc.push(v & 0x7f);
        v >>= 7;
        while (v > 0) { enc.push(0x80 | (v & 0x7f)); v >>= 7; }
        bytes.push(...enc.reverse());
      } else {
        bytes.push(v);
      }
    }
    return Buffer.concat([Buffer.from([0x06, bytes.length]), Buffer.from(bytes)]);
  }
  function derUtf8(str) {
    const buf = Buffer.from(str, "utf8");
    return Buffer.concat([Buffer.from([0x0c]), derLength(buf.length), buf]);
  }
  function derInteger(buf) {
    if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0x00]), buf]);
    return Buffer.concat([Buffer.from([0x02]), derLength(buf.length), buf]);
  }
  function derBitString(buf) {
    const wrapped = Buffer.concat([Buffer.from([0x00]), buf]);
    return Buffer.concat([Buffer.from([0x03]), derLength(wrapped.length), wrapped]);
  }
  function derGeneralizedTime(date) {
    const s = date.toISOString().replace(/[-:T]/g, "").slice(0, 14) + "Z";
    return Buffer.concat([Buffer.from([0x18, s.length]), Buffer.from(s)]);
  }
  function derExplicit(tag, content) {
    return Buffer.concat([Buffer.from([0xa0 | tag]), derLength(content.length), content]);
  }

  const pubDer = publicKey.export({ type: "spki", format: "der" });
  const cn = derSequence(derOid("2.5.4.3"), derUtf8("localhost"));
  const rdnSequence = derSequence(derSet(cn));
  const version = derExplicit(0, derInteger(Buffer.from([0x02])));
  const serialNumber = derInteger(serial);
  const sigAlg = derSequence(derOid("1.2.840.113549.1.1.11"), Buffer.from([0x05, 0x00]));
  const validity = derSequence(derGeneralizedTime(notBefore), derGeneralizedTime(notAfter));
  const tbs = derSequence(version, serialNumber, sigAlg, rdnSequence, validity, rdnSequence, pubDer);
  const sign = createSign("SHA256");
  sign.update(tbs);
  const signature = sign.sign(privateKey);
  const cert = derSequence(tbs, sigAlg, derBitString(signature));

  const keyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const certPem = `-----BEGIN CERTIFICATE-----\n${cert.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;

  writeFileSync(path.join(dir, "server.key"), keyPem);
  writeFileSync(path.join(dir, "server.crt"), certPem);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(__dirname, "certs");
const certPath = path.join(certDir, "server.crt");
const keyPath = path.join(certDir, "server.key");

// Generate test certs if they don't exist
if (!existsSync(certPath)) {
  generateCert(certDir);
}

const TEST_SERIAL = "01P00A000000001";
const TEST_ACCESS_CODE = "12345678";
const REQUEST_TOPIC = `device/${TEST_SERIAL}/request`;
const REPORT_TOPIC = `device/${TEST_SERIAL}/report`;

function connectTo(port, opts = {}) {
  return mqtt.connect(`mqtts://localhost:${port}`, {
    username: "bblp",
    password: TEST_ACCESS_CODE,
    rejectUnauthorized: false,
    clientId: `test-client-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...opts,
  });
}

function waitForConnect(client) {
  return new Promise((resolve, reject) => {
    client.on("connect", resolve);
    client.on("error", reject);
  });
}

describe("print-proxy", () => {
  let proxy;
  let port;
  let messages;

  before(async () => {
    messages = [];
    proxy = createProxy({
      port: 0,
      certPath,
      keyPath,
      accessCode: TEST_ACCESS_CODE,
      printerSerial: TEST_SERIAL,
      onMessage: (msg) => messages.push(msg),
    });
    await proxy.start();
    port = proxy.server.address().port;
  });

  after(async () => {
    await proxy.stop();
  });

  it("accepts MQTTS connections with correct credentials", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    assert.ok(client.connected);
    client.end(true);
  });

  it("rejects connections with wrong password", async () => {
    const client = connectTo(port, { password: "wrongpass" });
    const err = await new Promise((resolve) => {
      client.on("error", resolve);
    });
    assert.ok(err);
    client.end(true);
  });

  it("rejects connections with no password", async () => {
    const client = connectTo(port, { password: "" });
    const err = await new Promise((resolve) => {
      client.on("error", resolve);
    });
    assert.ok(err);
    client.end(true);
  });

  it("rejects connections with wrong username", async () => {
    const client = connectTo(port, { username: "hacker" });
    const err = await new Promise((resolve) => {
      client.on("error", resolve);
    });
    assert.ok(err);
    client.end(true);
  });

  it("logs request topic messages as STUDIO → PRINTER", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    messages.length = 0;

    const payload = {
      print: {
        sequence_id: "1",
        command: "project_file",
        subtask_name: "kneeler-boot",
        url: "ftp:///sdcard/kneeler-boot.3mf",
        use_ams: false,
      },
    };

    await new Promise((resolve) => {
      client.publish(REQUEST_TOPIC, JSON.stringify(payload), resolve);
    });

    await new Promise((r) => setTimeout(r, 50));

    const msg = messages.find((m) => m.direction === "STUDIO → PRINTER");
    assert.ok(msg, "Expected a STUDIO → PRINTER message");
    assert.equal(msg.topic, REQUEST_TOPIC);
    assert.equal(msg.payload.print.command, "project_file");
    assert.equal(msg.payload.print.subtask_name, "kneeler-boot");
    client.end(true);
  });

  it("logs report topic messages as PRINTER → STUDIO", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    messages.length = 0;

    const payload = {
      print: {
        sequence_id: "0",
        command: "push_status",
        gcode_state: "running",
        subtask_name: "kneeler-boot",
      },
    };

    await new Promise((resolve) => {
      client.publish(REPORT_TOPIC, JSON.stringify(payload), resolve);
    });

    await new Promise((r) => setTimeout(r, 50));

    const msg = messages.find((m) => m.direction === "PRINTER → STUDIO");
    assert.ok(msg, "Expected a PRINTER → STUDIO message");
    assert.equal(msg.topic, REPORT_TOPIC);
    assert.equal(msg.payload.print.gcode_state, "running");
    client.end(true);
  });

  it("logs unknown topics as UNKNOWN", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    messages.length = 0;

    await new Promise((resolve) => {
      client.publish("some/other/topic", "hello", resolve);
    });

    await new Promise((r) => setTimeout(r, 50));

    const msg = messages.find((m) => m.direction === "UNKNOWN");
    assert.ok(msg, "Expected an UNKNOWN direction message");
    assert.equal(msg.topic, "some/other/topic");
    client.end(true);
  });

  it("handles non-JSON payloads gracefully", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    messages.length = 0;

    await new Promise((resolve) => {
      client.publish(REQUEST_TOPIC, "not-json", resolve);
    });

    await new Promise((r) => setTimeout(r, 50));

    const msg = messages.find((m) => m.topic === REQUEST_TOPIC);
    assert.ok(msg);
    assert.equal(msg.payload, "not-json");
    client.end(true);
  });

  it("ignores $SYS system topics", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    messages.length = 0;

    await new Promise((resolve) => {
      client.publish("$SYS/broker/uptime", "123", resolve);
    });

    await new Promise((r) => setTimeout(r, 50));

    const sysMessages = messages.filter((m) => m.topic?.startsWith("$SYS"));
    assert.equal(sysMessages.length, 0);
    client.end(true);
  });

  it("rejects null password", async () => {
    const result = await new Promise((resolve) => {
      proxy.aedes.authenticate(null, "bblp", null, (err, success) => {
        resolve({ err, success });
      });
    });
    assert.ok(result.err);
    assert.equal(result.success, false);
  });
});

describe("isStartPrintCommand", () => {
  it("detects project_file command", () => {
    assert.equal(isStartPrintCommand({ print: { command: "project_file" } }), true);
  });

  it("detects gcode_file command", () => {
    assert.equal(isStartPrintCommand({ print: { command: "gcode_file" } }), true);
  });

  it("detects print_3mf command", () => {
    assert.equal(isStartPrintCommand({ print: { command: "print_3mf" } }), true);
  });

  it("returns false for push_all status commands", () => {
    assert.equal(isStartPrintCommand({ print: { command: "push_all" } }), false);
  });

  it("returns false for push_status commands", () => {
    assert.equal(isStartPrintCommand({ print: { command: "push_status" } }), false);
  });

  it("returns false for non-object payloads", () => {
    assert.equal(isStartPrintCommand("raw text"), false);
    assert.equal(isStartPrintCommand(null), false);
    assert.equal(isStartPrintCommand(42), false);
  });

  it("returns false when print key is absent", () => {
    assert.equal(isStartPrintCommand({ system: { command: "project_file" } }), false);
  });

  it("returns false for empty object", () => {
    assert.equal(isStartPrintCommand({}), false);
  });
});

describe("onIntercept", () => {
  let proxy;
  let port;
  let intercepted;

  before(async () => {
    intercepted = [];
    proxy = createProxy({
      port: 0,
      certPath,
      keyPath,
      accessCode: TEST_ACCESS_CODE,
      printerSerial: TEST_SERIAL,
      onMessage: () => {},
      async onIntercept({ topic, payload }) {
        intercepted.push({ topic, payload });
        return false; // always block
      },
    });
    await proxy.start();
    port = proxy.server.address().port;
  });

  after(async () => {
    await proxy.stop();
  });

  it("calls onIntercept for request topic messages", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    intercepted.length = 0;

    const payload = { print: { command: "project_file", subtask_name: "test-job" } };
    await new Promise((resolve) => client.publish(REQUEST_TOPIC, JSON.stringify(payload), resolve));
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(intercepted.length, 1);
    assert.equal(intercepted[0].payload.print.command, "project_file");
    client.end(true);
  });

  it("does not call onIntercept for report topic messages", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    intercepted.length = 0;

    const payload = { print: { command: "push_status", gcode_state: "running" } };
    await new Promise((resolve) => client.publish(REPORT_TOPIC, JSON.stringify(payload), resolve));
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(intercepted.length, 0);
    client.end(true);
  });

  it("client remains connected after a blocked job", async () => {
    const client = connectTo(port);
    await waitForConnect(client);

    const payload = { print: { command: "project_file", subtask_name: "blocked-job" } };
    await new Promise((resolve) => client.publish(REQUEST_TOPIC, JSON.stringify(payload), resolve));
    await new Promise((r) => setTimeout(r, 100));

    assert.ok(client.connected, "Studio client should remain connected after block");
    client.end(true);
  });
});

describe("createProxy with default logger", () => {
  it("uses defaultLog when onMessage is not provided", async () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    const proxy2 = createProxy({
      port: 0,
      certPath,
      keyPath,
      accessCode: TEST_ACCESS_CODE,
      printerSerial: TEST_SERIAL,
    });
    await proxy2.start();
    const p2port = proxy2.server.address().port;

    const client = connectTo(p2port);
    await waitForConnect(client);

    await new Promise((resolve) => {
      client.publish(REQUEST_TOPIC, JSON.stringify({ test: true }), resolve);
    });
    await new Promise((r) => setTimeout(r, 50));

    console.log = origLog;
    const found = logs.some((l) => l.includes("[STUDIO → PRINTER]"));
    assert.ok(found, "Expected defaultLog to have been called");

    client.end(true);
    await proxy2.stop();
  });
});

describe("upstream relay", () => {
  let fakeAedes;
  let fakePrinter;
  let fakePrinterPort;
  let proxy;
  let proxyPort;
  let printerReceived;

  before(async () => {
    printerReceived = [];

    // Stand up a fake printer (Aedes over TLS) to receive relayed messages
    fakeAedes = new Aedes();
    fakeAedes.authenticate = (_c, _u, _p, cb) => cb(null, true);
    fakeAedes.on("publish", (packet) => {
      if (!packet.topic.startsWith("$SYS")) {
        printerReceived.push({ topic: packet.topic, payload: packet.payload.toString() });
      }
    });

    const tlsOpts = { key: readFileSync(keyPath), cert: readFileSync(certPath) };
    fakePrinter = tls.createServer(tlsOpts, fakeAedes.handle);
    await new Promise((resolve) => fakePrinter.listen(0, resolve));
    fakePrinterPort = fakePrinter.address().port;

    proxy = createProxy({
      port: 0,
      certPath,
      keyPath,
      accessCode: TEST_ACCESS_CODE,
      printerSerial: TEST_SERIAL,
      printerIp: "localhost",
      printerPort: fakePrinterPort,
      onMessage: () => {},
      onIntercept: () => Promise.resolve(true),
    });

    await proxy.start();
    proxyPort = proxy.server.address().port;

    // Wait for upstream to connect to fake printer
    await new Promise((resolve, reject) => {
      if (proxy.upstreamClient.connected) return resolve();
      proxy.upstreamClient.on("connect", resolve);
      proxy.upstreamClient.on("error", reject);
    });
  });

  after(async () => {
    await proxy.stop();
    await new Promise((resolve) => {
      fakeAedes.close(() => fakePrinter.close(resolve));
    });
  });

  it("forwards request messages to the upstream printer", async () => {
    const client = connectTo(proxyPort);
    await waitForConnect(client);
    printerReceived.length = 0;

    const payload = { print: { command: "push_all" } };
    await new Promise((resolve) => client.publish(REQUEST_TOPIC, JSON.stringify(payload), resolve));
    await new Promise((r) => setTimeout(r, 150));

    const fwd = printerReceived.find((m) => m.topic === REQUEST_TOPIC);
    assert.ok(fwd, "Expected message to be forwarded to fake printer");
    assert.ok(fwd.payload.includes("push_all"));
    client.end(true);
  });

  it("relays printer reports back to studio clients", async () => {
    const client = connectTo(proxyPort);
    await waitForConnect(client);

    const received = [];
    await new Promise((resolve) => client.subscribe(REPORT_TOPIC, resolve));
    client.on("message", (_topic, payload) => received.push(payload.toString()));

    // Publish a report directly on the fake printer's Aedes broker
    const reportPayload = JSON.stringify({ print: { bed_temper: 60.5, command: "push_status" } });
    fakeAedes.publish({ topic: REPORT_TOPIC, payload: Buffer.from(reportPayload), qos: 0, retain: false }, () => {});

    await new Promise((r) => setTimeout(r, 300));

    assert.ok(received.length > 0, "Expected studio client to receive relayed report");
    const parsed = JSON.parse(received[0]);
    assert.equal(parsed.print.bed_temper, 60.5);
    client.end(true);
  });
});

describe("upstream error handling", () => {
  it("logs auth-specific message when upstream error code is 5", async () => {
    const errors = [];
    const origError = console.error;
    const origLog = console.log;
    console.error = (...args) => errors.push(args.join(" "));
    console.log = () => {}; // suppress noise

    // Use a port that no MQTT broker is listening on — will trigger connection error
    // But to specifically test code-5 path, we emit the error manually
    const p = createProxy({
      port: 0,
      certPath,
      keyPath,
      accessCode: TEST_ACCESS_CODE,
      printerSerial: TEST_SERIAL,
      printerIp: "localhost",
      printerPort: 19999, // nothing listening here
      onMessage: () => {},
    });

    await p.start();

    // Emit a code-5 error on the upstream client
    const err5 = new Error("Connection refused");
    err5.code = 5;
    p.upstreamClient.emit("error", err5);

    console.error = origError;
    console.log = origLog;

    assert.ok(errors.some((e) => e.includes("upstream auth failed")));

    await p.stop();
  });

  it("logs subscribe error when upstream subscribe fails", async () => {
    const errors = [];
    const origError = console.error;
    const origLog = console.log;
    console.error = (...args) => errors.push(args.join(" "));
    console.log = () => {};

    // Create a fake printer that rejects subscriptions
    const fakeAedes = new Aedes();
    fakeAedes.authenticate = (_c, _u, _p, cb) => cb(null, true);
    fakeAedes.authorizeSubscribe = (_client, _sub, cb) => {
      cb(new Error("subscribe denied"));
    };

    const tlsOpts = { key: readFileSync(keyPath), cert: readFileSync(certPath) };
    const fakePrinter = tls.createServer(tlsOpts, fakeAedes.handle);
    await new Promise((resolve) => fakePrinter.listen(0, resolve));
    const fakePort = fakePrinter.address().port;

    const p = createProxy({
      port: 0,
      certPath,
      keyPath,
      accessCode: TEST_ACCESS_CODE,
      printerSerial: TEST_SERIAL,
      printerIp: "localhost",
      printerPort: fakePort,
      onMessage: () => {},
    });

    await p.start();

    // Wait for upstream connect + subscribe attempt
    await new Promise((resolve, reject) => {
      if (p.upstreamClient.connected) return resolve();
      p.upstreamClient.on("connect", resolve);
      p.upstreamClient.on("error", reject);
    });
    await new Promise((r) => setTimeout(r, 200));

    console.error = origError;
    console.log = origLog;

    assert.ok(errors.some((e) => e.includes("upstream subscribe error")));

    await p.stop();
    await new Promise((resolve) => {
      fakeAedes.close(() => fakePrinter.close(resolve));
    });
  });

  it("logs generic message for non-code-5 upstream errors", async () => {
    const errors = [];
    const origError = console.error;
    const origLog = console.log;
    console.error = (...args) => errors.push(args.join(" "));
    console.log = () => {};

    const p = createProxy({
      port: 0,
      certPath,
      keyPath,
      accessCode: TEST_ACCESS_CODE,
      printerSerial: TEST_SERIAL,
      printerIp: "localhost",
      printerPort: 19999,
      onMessage: () => {},
    });

    await p.start();

    const errGeneric = new Error("ECONNREFUSED");
    errGeneric.code = "ECONNREFUSED";
    p.upstreamClient.emit("error", errGeneric);

    console.error = origError;
    console.log = origLog;

    assert.ok(errors.some((e) => e.includes("upstream error: ECONNREFUSED")));

    await p.stop();
  });
});

describe("cert watcher failure", () => {
  it("silently handles fs.watch failure", async () => {
    const origWatch = fs.watch;
    fs.watch = () => { throw new Error("watch not supported"); };

    const p = createProxy({
      port: 0,
      certPath,
      keyPath,
      accessCode: TEST_ACCESS_CODE,
      printerSerial: TEST_SERIAL,
      onMessage: () => {},
    });

    // start() calls startCertWatcher which should not throw
    await p.start();
    fs.watch = origWatch;

    assert.ok(true, "Proxy started despite fs.watch failure");
    await p.stop();
  });
});

describe("cert hot-reload", () => {
  let proxy;
  let tmpCertDir;
  let tmpCertPath;
  let tmpKeyPath;

  before(async () => {
    tmpCertDir = mkdtempSync(path.join(os.tmpdir(), "proxy-certs-"));
    tmpCertPath = path.join(tmpCertDir, "server.crt");
    tmpKeyPath = path.join(tmpCertDir, "server.key");
    generateCert(tmpCertDir);

    proxy = createProxy({
      port: 0,
      certPath: tmpCertPath,
      keyPath: tmpKeyPath,
      accessCode: TEST_ACCESS_CODE,
      printerSerial: TEST_SERIAL,
      onMessage: () => {},
    });
    await proxy.start();
  });

  after(async () => {
    await proxy.stop();
  });

  it("reloadCerts updates TLS context without restarting", () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    proxy.reloadCerts();

    console.log = origLog;
    assert.ok(logs.some((l) => l.includes("TLS certs reloaded")));
  });

  it("logs error when cert files are invalid", () => {
    const errors = [];
    const origError = console.error;
    console.error = (...args) => errors.push(args.join(" "));

    // Write garbage to the cert file
    const origCert = readFileSync(tmpCertPath);
    writeFileSync(tmpCertPath, "not-a-cert");

    proxy.reloadCerts();

    // Restore valid cert
    writeFileSync(tmpCertPath, origCert);

    console.error = origError;
    assert.ok(errors.some((e) => e.includes("cert reload failed")));
  });

  it("auto-reloads when key file changes on disk", async () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    // Touch the key file to trigger the watcher via key path
    const keyContent = readFileSync(tmpKeyPath);
    writeFileSync(tmpKeyPath, keyContent);

    await new Promise((r) => setTimeout(r, 1000));

    console.log = origLog;
    assert.ok(logs.some((l) => l.includes("TLS certs reloaded")), "Expected auto-reload after key file change");
  });

  it("auto-reloads when cert files change on disk", async () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    // Regenerate certs to trigger the file watcher
    generateCert(tmpCertDir);

    // Wait for debounce (500ms) + buffer
    await new Promise((r) => setTimeout(r, 1000));

    console.log = origLog;
    assert.ok(logs.some((l) => l.includes("TLS certs reloaded")), "Expected auto-reload after cert file change");
  });
});

describe("defaultLog", () => {
  it("logs JSON payloads as pretty-printed JSON", () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));
    defaultLog({ direction: "STUDIO → PRINTER", topic: "test/topic", payload: { key: "value" } });
    console.log = origLog;
    assert.ok(logs[0].includes("[STUDIO → PRINTER]"));
    assert.ok(logs[1].includes('"key": "value"'));
  });

  it("logs string payloads as-is", () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));
    defaultLog({ direction: "UNKNOWN", topic: "test/topic", payload: "raw-text" });
    console.log = origLog;
    assert.equal(logs[1], "raw-text");
  });
});
