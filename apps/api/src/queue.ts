import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { QUEUE_NAME } from "@webapp/contracts";
import type { Env } from "./env.js";

export type NfeJobPayload = {
  jobId: string;
  xmlPaths: string[];
  outputPath: string;
};

let connection: Redis | null = null;
let queue: Queue<NfeJobPayload> | null = null;

export function getRedis(env: Env): Redis {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      connectTimeout: 5_000,
    });
  }
  return connection;
}

export function getQueue(env: Env): Queue<NfeJobPayload> {
  if (!queue) {
    queue = new Queue<NfeJobPayload>(QUEUE_NAME, {
      connection: getRedis(env),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return queue;
}
