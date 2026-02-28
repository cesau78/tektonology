import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mqtt from "mqtt";
import { createProxy, defaultLog } from "./proxy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(__dirname, "certs");
const certPath = path.join(certDir, "server.crt");
const keyPath = path.join(certDir, "server.key");

// Generate test certs if they don't exist
if (!existsSync(certPath)) {
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 1 -nodes -subj "/CN=localhost"`,
    { stdio: "ignore" }
  );
}

const TEST_SERIAL = "01P00A000000001";
const TEST_ACCESS_CODE = "12345678";
const REQUEST_TOPIC = `device/${TEST_SERIAL}/request`;
const REPORT_TOPIC = `device/${TEST_SERIAL}/report`;

describe("print-proxy", () => {
  let proxy;
  let port;
  let messages;

  before(async () => {
    messages = [];
    // Use port 0 to let the OS pick a free port
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

  function connect(opts = {}) {
    return mqtt.connect(`mqtts://localhost:${port}`, {
      username: "bblp",
      password: TEST_ACCESS_CODE,
      rejectUnauthorized: false,
      clientId: `test-client-${Date.now()}`,
      ...opts,
    });
  }

  function waitForConnect(client) {
    return new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("error", reject);
    });
  }

  it("accepts MQTTS connections with correct credentials", async () => {
    const client = connect();
    await waitForConnect(client);
    assert.ok(client.connected);
    client.end(true);
  });

  it("rejects connections with wrong password", async () => {
    const client = connect({ password: "wrongpass" });
    const err = await new Promise((resolve) => {
      client.on("error", resolve);
    });
    assert.ok(err);
    client.end(true);
  });

  it("rejects connections with no password", async () => {
    const client = connect({ password: "" });
    const err = await new Promise((resolve) => {
      client.on("error", resolve);
    });
    assert.ok(err);
    client.end(true);
  });

  it("rejects connections with wrong username", async () => {
    const client = connect({ username: "hacker" });
    const err = await new Promise((resolve) => {
      client.on("error", resolve);
    });
    assert.ok(err);
    client.end(true);
  });

  it("logs request topic messages as STUDIO → PRINTER", async () => {
    const client = connect();
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

    // Give aedes a moment to process
    await new Promise((r) => setTimeout(r, 50));

    const msg = messages.find((m) => m.direction === "STUDIO → PRINTER");
    assert.ok(msg, "Expected a STUDIO → PRINTER message");
    assert.equal(msg.topic, REQUEST_TOPIC);
    assert.equal(msg.payload.print.command, "project_file");
    assert.equal(msg.payload.print.subtask_name, "kneeler-boot");
    client.end(true);
  });

  it("logs report topic messages as PRINTER → STUDIO", async () => {
    const client = connect();
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
    const client = connect();
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
    const client = connect();
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
    const client = connect();
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

describe("authenticate edge cases", () => {
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

    const client = mqtt.connect(`mqtts://localhost:${p2port}`, {
      username: "bblp",
      password: TEST_ACCESS_CODE,
      rejectUnauthorized: false,
      clientId: `default-log-test-${Date.now()}`,
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("error", reject);
    });

    await new Promise((resolve) => {
      client.publish(`device/${TEST_SERIAL}/request`, JSON.stringify({ test: true }), resolve);
    });
    await new Promise((r) => setTimeout(r, 50));

    console.log = origLog;
    const found = logs.some((l) => l.includes("[STUDIO → PRINTER]"));
    assert.ok(found, "Expected defaultLog to have been called");

    client.end(true);
    await proxy2.stop();
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
