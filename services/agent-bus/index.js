import { Queue as BullQueue, Worker as BullWorker } from "bullmq";

const QUEUE_NAMES = {
  PRINT_JOB_COMPLETED: "print-job-completed",
};

function getConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
  };
}

function createQueue(name, { QueueClass = BullQueue } = {}) {
  return new QueueClass(name, { connection: getConnection() });
}

function createWorker(name, handler, opts = {}, { WorkerClass = BullWorker } = {}) {
  return new WorkerClass(name, handler, {
    connection: getConnection(),
    ...opts,
  });
}

export { QUEUE_NAMES, getConnection, createQueue, createWorker };
