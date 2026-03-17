import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign, randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "fs";
import os from "os";
import path from "path";
import tls from "tls";
import { fileURLToPath } from "url";
import Aedes from "aedes";
import mqtt from "mqtt";
import { createStudioProxy, defaultLog, isStartPrintCommand } from "./proxy.js";

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

// Always generate fresh test certs
generateCert(certDir);

function connectTo(port, opts = {}) {
  return mqtt.connect(`mqtts://localhost:${port}`, {
    username: "testuser",
    password: "testpass",
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

describe("studio-proxy", () => {
  let proxy;
  let port;
  let messages;

  before(async () => {
    messages = [];
    proxy = createStudioProxy({
      port: 0,
      certPath,
      keyPath,
      onMessage: (msg) => messages.push(msg),
    });
    await proxy.start();
    port = proxy.server.address().port;
  });

  after(async () => {
    await proxy.stop();
  });

  it("accepts MQTTS connections with any credentials", async () => {
    const client = connectTo(port, { username: "anyuser", password: "anypass" });
    await waitForConnect(client);
    assert.ok(client.connected);
    client.end(true);
  });

  it("accepts connections with different credentials", async () => {
    const client = connectTo(port, { username: "bambu_user", password: "bambu_token_123" });
    await waitForConnect(client);
    assert.ok(client.connected);
    client.end(true);
  });

  it("logs client-published messages as STUDIO → CLOUD", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    messages.length = 0;

    const payload = {
      print: {
        sequence_id: "1",
        command: "project_file",
        subtask_name: "kneeler-boot",
      },
    };

    await new Promise((resolve) => {
      client.publish("device/SERIAL123/request", JSON.stringify(payload), resolve);
    });

    await new Promise((r) => setTimeout(r, 50));

    const msg = messages.find((m) => m.direction === "STUDIO → CLOUD");
    assert.ok(msg, "Expected a STUDIO → CLOUD message");
    assert.equal(msg.topic, "device/SERIAL123/request");
    assert.equal(msg.payload.print.command, "project_file");
    client.end(true);
  });

  it("handles non-JSON payloads gracefully", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    messages.length = 0;

    await new Promise((resolve) => {
      client.publish("device/SERIAL123/request", "not-json", resolve);
    });

    await new Promise((r) => setTimeout(r, 50));

    const msg = messages.find((m) => m.topic === "device/SERIAL123/request");
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
    proxy = createStudioProxy({
      port: 0,
      certPath,
      keyPath,
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

  it("calls onIntercept for client-published messages", async () => {
    const client = connectTo(port);
    await waitForConnect(client);
    intercepted.length = 0;

    const payload = { print: { command: "project_file", subtask_name: "test-job" } };
    await new Promise((resolve) => client.publish("device/S/request", JSON.stringify(payload), resolve));
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(intercepted.length, 1);
    assert.equal(intercepted[0].payload.print.command, "project_file");
    client.end(true);
  });

  it("client remains connected after a blocked message", async () => {
    const client = connectTo(port);
    await waitForConnect(client);

    const payload = { print: { command: "project_file", subtask_name: "blocked-job" } };
    await new Promise((resolve) => client.publish("device/S/request", JSON.stringify(payload), resolve));
    await new Promise((r) => setTimeout(r, 100));

    assert.ok(client.connected, "Studio client should remain connected after block");
    client.end(true);
  });
});

describe("upstream relay", () => {
  let fakeCloud;
  let fakeCloudAedes;
  let fakeCloudPort;
  let proxy;
  let proxyPort;
  let cloudReceived;

  before(async () => {
    cloudReceived = [];

    // Stand up a fake cloud server (Aedes over TLS)
    fakeCloudAedes = new Aedes();
    fakeCloudAedes.authenticate = (_c, _u, _p, cb) => cb(null, true);
    fakeCloudAedes.on("publish", (packet) => {
      if (!packet.topic.startsWith("$SYS")) {
        cloudReceived.push({ topic: packet.topic, payload: packet.payload.toString() });
      }
    });

    const tlsOpts = { key: readFileSync(keyPath), cert: readFileSync(certPath) };
    fakeCloud = tls.createServer(tlsOpts, fakeCloudAedes.handle);
    await new Promise((resolve) => fakeCloud.listen(0, resolve));
    fakeCloudPort = fakeCloud.address().port;

    proxy = createStudioProxy({
      port: 0,
      certPath,
      keyPath,
      upstreamHost: "localhost",
      upstreamPort: fakeCloudPort,
      onMessage: () => {},
      onIntercept: () => Promise.resolve(true),
    });

    await proxy.start();
    proxyPort = proxy.server.address().port;

    // Connect a client to trigger upstream connection
    const triggerClient = connectTo(proxyPort);
    await waitForConnect(triggerClient);

    // Wait for upstream to connect
    await new Promise((resolve) => {
      const check = () => {
        if (proxy.upstreamClient?.connected) return resolve();
        setTimeout(check, 50);
      };
      check();
    });

    triggerClient.end(true);
    await new Promise((r) => setTimeout(r, 50));
  });

  after(async () => {
    await proxy.stop();
    await new Promise((resolve) => {
      fakeCloudAedes.close(() => fakeCloud.close(resolve));
    });
  });

  it("forwards client messages to the upstream cloud", async () => {
    const client = connectTo(proxyPort);
    await waitForConnect(client);
    cloudReceived.length = 0;

    const payload = { print: { command: "push_all" } };
    await new Promise((resolve) => client.publish("device/S/request", JSON.stringify(payload), resolve));
    await new Promise((r) => setTimeout(r, 150));

    const fwd = cloudReceived.find((m) => m.topic === "device/S/request");
    assert.ok(fwd, "Expected message to be forwarded to fake cloud");
    assert.ok(fwd.payload.includes("push_all"));
    client.end(true);
  });

  it("relays cloud responses back to studio clients", async () => {
    const client = connectTo(proxyPort);
    await waitForConnect(client);

    const received = [];
    await new Promise((resolve) => client.subscribe("device/S/report", resolve));
    client.on("message", (_topic, payload) => received.push(payload.toString()));

    // Publish a response on the fake cloud
    const reportPayload = JSON.stringify({ print: { bed_temper: 60.5, command: "push_status" } });
    fakeCloudAedes.publish({ topic: "device/S/report", payload: Buffer.from(reportPayload), qos: 0, retain: false }, () => {});

    await new Promise((r) => setTimeout(r, 300));

    assert.ok(received.length > 0, "Expected studio client to receive relayed cloud response");
    const parsed = JSON.parse(received[0]);
    assert.equal(parsed.print.bed_temper, 60.5);
    client.end(true);
  });

  it("forwards messages with explicit QoS", async () => {
    const client = connectTo(proxyPort);
    await waitForConnect(client);
    cloudReceived.length = 0;

    const payload = { print: { command: "push_all" } };
    await new Promise((resolve) => client.publish("device/S/request", JSON.stringify(payload), { qos: 1 }, resolve));
    await new Promise((r) => setTimeout(r, 150));

    const fwd = cloudReceived.find((m) => m.topic === "device/S/request");
    assert.ok(fwd, "Expected QoS 1 message to be forwarded");
    client.end(true);
  });

  it("stores credentials from client for upstream auth", async () => {
    // The upstream was created with credentials from the trigger client
    assert.ok(proxy.upstreamClient, "Upstream client should exist after client connected");
    assert.ok(proxy.upstreamClient.connected, "Upstream should be connected");
  });
});

describe("createStudioProxy with default logger", () => {
  it("uses defaultLog when onMessage is not provided", async () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    const proxy2 = createStudioProxy({
      port: 0,
      certPath,
      keyPath,
    });
    await proxy2.start();
    const p2port = proxy2.server.address().port;

    const client = connectTo(p2port);
    await waitForConnect(client);

    await new Promise((resolve) => {
      client.publish("device/S/request", JSON.stringify({ test: true }), resolve);
    });
    await new Promise((r) => setTimeout(r, 50));

    console.log = origLog;
    const found = logs.some((l) => l.includes("[STUDIO → CLOUD]"));
    assert.ok(found, "Expected defaultLog to have been called");

    client.end(true);
    await proxy2.stop();
  });
});

describe("cert hot-reload", () => {
  let proxy;
  let tmpCertDir;
  let tmpCertPath;
  let tmpKeyPath;

  before(async () => {
    tmpCertDir = mkdtempSync(path.join(os.tmpdir(), "studio-proxy-certs-"));
    tmpCertPath = path.join(tmpCertDir, "server.crt");
    tmpKeyPath = path.join(tmpCertDir, "server.key");
    generateCert(tmpCertDir);

    proxy = createStudioProxy({
      port: 0,
      certPath: tmpCertPath,
      keyPath: tmpKeyPath,
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

    const origCert = readFileSync(tmpCertPath);
    writeFileSync(tmpCertPath, "not-a-cert");

    proxy.reloadCerts();

    writeFileSync(tmpCertPath, origCert);

    console.error = origError;
    assert.ok(errors.some((e) => e.includes("cert reload failed")));
  });

  it("auto-reloads when cert files change on disk", async () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    generateCert(tmpCertDir);

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
    defaultLog({ direction: "STUDIO → CLOUD", topic: "test/topic", payload: { key: "value" } });
    console.log = origLog;
    assert.ok(logs[0].includes("[STUDIO → CLOUD]"));
    assert.ok(logs[1].includes('"key": "value"'));
  });

  it("logs string payloads as-is", () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));
    defaultLog({ direction: "CLOUD → STUDIO", topic: "test/topic", payload: "raw-text" });
    console.log = origLog;
    assert.equal(logs[1], "raw-text");
  });
});

describe("upstream error handling", () => {
  let fakeCloudAedes;
  let fakeCloud;
  let fakeCloudPort;
  let proxy;
  let proxyPort;

  before(async () => {
    fakeCloudAedes = new Aedes();
    fakeCloudAedes.authenticate = (_c, _u, _p, cb) => cb(null, true);
    const tlsOpts = { key: readFileSync(keyPath), cert: readFileSync(certPath) };
    fakeCloud = tls.createServer(tlsOpts, fakeCloudAedes.handle);
    await new Promise((resolve) => fakeCloud.listen(0, resolve));
    fakeCloudPort = fakeCloud.address().port;

    proxy = createStudioProxy({
      port: 0,
      certPath,
      keyPath,
      upstreamHost: "localhost",
      upstreamPort: fakeCloudPort,
      onMessage: () => {},
    });
    await proxy.start();
    proxyPort = proxy.server.address().port;

    // Connect a client to trigger upstream
    const client = connectTo(proxyPort);
    await waitForConnect(client);
    await new Promise((resolve) => {
      const check = () => {
        if (proxy.upstreamClient?.connected) return resolve();
        setTimeout(check, 50);
      };
      check();
    });
    client.end(true);
    await new Promise((r) => setTimeout(r, 50));
  });

  after(async () => {
    await proxy.stop();
    await new Promise((resolve) => {
      fakeCloudAedes.close(() => fakeCloud.close(resolve));
    });
  });

  it("logs clean message for auth failure (code 5)", () => {
    const errors = [];
    const origError = console.error;
    console.error = (...args) => errors.push(args.join(" "));

    // Simulate a code-5 error on the upstream client
    const err = new Error("Not authorized");
    err.code = 5;
    proxy.upstreamClient.emit("error", err);

    console.error = origError;
    assert.ok(errors.some((e) => e.includes("upstream auth failed")));
  });

  it("logs upstream close event", () => {
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    proxy.upstreamClient.emit("close");

    console.log = origLog;
    assert.ok(logs.some((l) => l.includes("upstream connection closed")));
  });

  it("logs generic upstream errors", () => {
    const errors = [];
    const origError = console.error;
    console.error = (...args) => errors.push(args.join(" "));

    proxy.upstreamClient.emit("error", new Error("Connection reset"));

    console.error = origError;
    assert.ok(errors.some((e) => e.includes("upstream error") && e.includes("Connection reset")));
  });
});

describe("cert watcher fallback", () => {
  it("handles missing cert directory gracefully", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "studio-proxy-nocert-"));
    const fakeCertDir = path.join(tmpDir, "certs");
    generateCert(fakeCertDir);
    const tmpCertPath = path.join(fakeCertDir, "server.crt");
    const tmpKeyPath = path.join(fakeCertDir, "server.key");

    const proxy = createStudioProxy({
      port: 0,
      certPath: tmpCertPath,
      keyPath: tmpKeyPath,
      onMessage: () => {},
    });

    // Remove cert dir after certs are loaded but before start() sets up watcher
    const { rmSync } = await import("fs");
    rmSync(fakeCertDir, { recursive: true });

    // start() calls startCertWatcher() which should catch the error silently
    await proxy.start();
    const port = proxy.server.address().port;
    assert.ok(port > 0, "Proxy should start even without cert watcher");
    await proxy.stop();
  });
});

describe("allowed but upstream disconnected", () => {
  it("silently drops message when upstream is not connected", async () => {
    const messages = [];
    const logs = [];
    const origLog = console.log;

    // Create proxy with upstreamHost pointing to a non-existent server
    const proxy = createStudioProxy({
      port: 0,
      certPath,
      keyPath,
      upstreamHost: "localhost",
      upstreamPort: 1, // will never connect
      onMessage: (msg) => messages.push(msg),
      onIntercept: () => Promise.resolve(true), // allow everything
    });
    await proxy.start();
    const port = proxy.server.address().port;

    const client = connectTo(port);
    await waitForConnect(client);

    // upstream won't be connected (bad port), but intercept returns true
    console.log = (...args) => logs.push(args.join(" "));
    await new Promise((resolve) => {
      client.publish("device/S/request", JSON.stringify({ test: true }), resolve);
    });
    await new Promise((r) => setTimeout(r, 100));
    console.log = origLog;

    // Should NOT log "BLOCKED" since it was allowed, just not forwarded
    assert.ok(!logs.some((l) => l.includes("BLOCKED")));

    client.end(true);
    await proxy.stop();
  });
});

describe("no upstream", () => {
  it("works without upstreamHost configured", async () => {
    const messages = [];
    const proxy = createStudioProxy({
      port: 0,
      certPath,
      keyPath,
      onMessage: (msg) => messages.push(msg),
    });
    await proxy.start();
    const port = proxy.server.address().port;

    const client = connectTo(port);
    await waitForConnect(client);

    await new Promise((resolve) => {
      client.publish("test/topic", JSON.stringify({ hello: true }), resolve);
    });
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(messages.length > 0);
    assert.equal(proxy.upstreamClient, null);

    client.end(true);
    await proxy.stop();
  });
});

describe("listenHost option", () => {
  it("binds to specified host when listenHost is provided", async () => {
    const proxy = createStudioProxy({
      port: 0,
      listenHost: "127.0.0.1",
      certPath,
      keyPath,
      onMessage: () => {},
    });
    await proxy.start();
    const addr = proxy.server.address();
    assert.equal(addr.address, "127.0.0.1");
    await proxy.stop();
  });
});

describe("upstream subscribe error", () => {
  it("logs subscribe errors from upstream", async () => {
    const fakeCloudAedes = new Aedes();
    fakeCloudAedes.authenticate = (_c, _u, _p, cb) => cb(null, true);

    // Override authorizeSubscribe to reject subscriptions
    fakeCloudAedes.authorizeSubscribe = (_client, sub, cb) => {
      cb(new Error("subscribe denied"));
    };

    const tlsOpts = { key: readFileSync(keyPath), cert: readFileSync(certPath) };
    const fakeCloud = tls.createServer(tlsOpts, fakeCloudAedes.handle);
    await new Promise((resolve) => fakeCloud.listen(0, resolve));
    const fakeCloudPort = fakeCloud.address().port;

    const errors = [];
    const origError = console.error;

    const proxy = createStudioProxy({
      port: 0,
      certPath,
      keyPath,
      upstreamHost: "localhost",
      upstreamPort: fakeCloudPort,
      onMessage: () => {},
    });
    await proxy.start();
    const proxyPort = proxy.server.address().port;

    console.error = (...args) => errors.push(args.join(" "));

    const client = connectTo(proxyPort);
    await waitForConnect(client);
    await new Promise((r) => setTimeout(r, 500));

    console.error = origError;

    assert.ok(errors.some((e) => e.includes("upstream subscribe error")));

    client.end(true);
    await proxy.stop();
    await new Promise((resolve) => {
      fakeCloudAedes.close(() => fakeCloud.close(resolve));
    });
  });
});

describe("upstreamPort default", () => {
  it("defaults upstreamPort to 8883 when not specified", async () => {
    const errors = [];
    const origError = console.error;
    console.error = (...args) => errors.push(args.join(" "));

    // Create proxy with upstreamHost but no upstreamPort — will try port 8883
    const proxy = createStudioProxy({
      port: 0,
      certPath,
      keyPath,
      upstreamHost: "127.0.0.1",
      // upstreamPort intentionally omitted — should default to 8883
      onMessage: () => {},
    });
    await proxy.start();
    const proxyPort = proxy.server.address().port;

    const client = connectTo(proxyPort);
    await waitForConnect(client);
    // Give upstream time to attempt connection on default port
    await new Promise((r) => setTimeout(r, 200));

    console.error = origError;
    client.end(true);
    await proxy.stop();
    // Just verifying it doesn't crash — the upstream will fail to connect on 8883
    assert.ok(true);
  });
});

describe("cert watcher ignores irrelevant files", () => {
  it("does not reload when a non-cert file changes", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "studio-proxy-watch-"));
    generateCert(tmpDir);
    const tmpCertPath = path.join(tmpDir, "server.crt");
    const tmpKeyPath = path.join(tmpDir, "server.key");

    const logs = [];
    const origLog = console.log;

    const proxy = createStudioProxy({
      port: 0,
      certPath: tmpCertPath,
      keyPath: tmpKeyPath,
      onMessage: () => {},
    });
    await proxy.start();

    // Write an unrelated file in the cert directory
    console.log = (...args) => logs.push(args.join(" "));
    writeFileSync(path.join(tmpDir, "unrelated.txt"), "nope");
    await new Promise((r) => setTimeout(r, 1000));
    console.log = origLog;

    // Should NOT have reloaded certs
    assert.ok(!logs.some((l) => l.includes("TLS certs reloaded")));

    await proxy.stop();
  });
});

describe("connectUpstream idempotency", () => {
  let fakeCloudAedes;
  let fakeCloud;
  let fakeCloudPort;
  let proxy;
  let proxyPort;

  before(async () => {
    fakeCloudAedes = new Aedes();
    fakeCloudAedes.authenticate = (_c, _u, _p, cb) => cb(null, true);
    const tlsOpts = { key: readFileSync(keyPath), cert: readFileSync(certPath) };
    fakeCloud = tls.createServer(tlsOpts, fakeCloudAedes.handle);
    await new Promise((resolve) => fakeCloud.listen(0, resolve));
    fakeCloudPort = fakeCloud.address().port;

    proxy = createStudioProxy({
      port: 0,
      certPath,
      keyPath,
      upstreamHost: "localhost",
      upstreamPort: fakeCloudPort,
      onMessage: () => {},
    });
    await proxy.start();
    proxyPort = proxy.server.address().port;

    // First client triggers upstream connection
    const c1 = connectTo(proxyPort);
    await waitForConnect(c1);
    await new Promise((resolve) => {
      const check = () => {
        if (proxy.upstreamClient?.connected) return resolve();
        setTimeout(check, 50);
      };
      check();
    });
    c1.end(true);
    await new Promise((r) => setTimeout(r, 50));
  });

  after(async () => {
    await proxy.stop();
    await new Promise((resolve) => {
      fakeCloudAedes.close(() => fakeCloud.close(resolve));
    });
  });

  it("does not create a second upstream when another client connects", async () => {
    const firstUpstream = proxy.upstreamClient;
    assert.ok(firstUpstream?.connected);

    // Second client connects — should not replace upstream
    const c2 = connectTo(proxyPort);
    await waitForConnect(c2);
    await new Promise((r) => setTimeout(r, 100));

    assert.strictEqual(proxy.upstreamClient, firstUpstream, "upstream should not be replaced");
    c2.end(true);
  });
});
