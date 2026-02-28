import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getConnection, createQueue, createWorker, QUEUE_NAMES } from "./index.js";

describe("QUEUE_NAMES", () => {
  it("exports the print-job-completed queue name", () => {
    assert.equal(QUEUE_NAMES.PRINT_JOB_COMPLETED, "print-job-completed");
  });
});

describe("getConnection", () => {
  let originalRedisUrl;

  beforeEach(() => {
    originalRedisUrl = process.env.REDIS_URL;
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it("defaults to localhost:6379 when REDIS_URL is not set", () => {
    delete process.env.REDIS_URL;
    const conn = getConnection();
    assert.equal(conn.host, "localhost");
    assert.equal(conn.port, 6379);
  });

  it("parses a custom REDIS_URL", () => {
    process.env.REDIS_URL = "redis://my-redis-host:6380";
    const conn = getConnection();
    assert.equal(conn.host, "my-redis-host");
    assert.equal(conn.port, 6380);
  });

  it("defaults port to 6379 when not specified in URL", () => {
    process.env.REDIS_URL = "redis://some-host";
    const conn = getConnection();
    assert.equal(conn.host, "some-host");
    assert.equal(conn.port, 6379);
  });
});

describe("createQueue", () => {
  it("instantiates a queue with the given name and connection", () => {
    let captured;
    class FakeQueue {
      constructor(name, opts) { captured = { name, opts }; }
    }

    createQueue("test-queue", { QueueClass: FakeQueue });

    assert.equal(captured.name, "test-queue");
    assert.equal(captured.opts.connection.host, "localhost");
    assert.equal(captured.opts.connection.port, 6379);
  });
});

describe("createWorker", () => {
  it("instantiates a worker with name, handler, and merged opts", () => {
    let captured;
    class FakeWorker {
      constructor(name, handler, opts) { captured = { name, handler, opts }; }
    }

    const handler = async () => {};
    createWorker("test-queue", handler, { limiter: { max: 5 } }, { WorkerClass: FakeWorker });

    assert.equal(captured.name, "test-queue");
    assert.equal(captured.handler, handler);
    assert.equal(captured.opts.connection.host, "localhost");
    assert.deepEqual(captured.opts.limiter, { max: 5 });
  });

  it("uses default empty opts when none provided", () => {
    let captured;
    class FakeWorker {
      constructor(name, handler, opts) { captured = { name, handler, opts }; }
    }

    createWorker("q", async () => {}, undefined, { WorkerClass: FakeWorker });

    assert.equal(captured.name, "q");
    assert.ok(captured.opts.connection);
  });
});
