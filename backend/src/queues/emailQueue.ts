import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { URL } from "url";

export function redisConnectionFromEnv(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const u = new URL(redisUrl);

    const isTLS = u.protocol === "rediss:";
    const password = u.password ? decodeURIComponent(u.password) : undefined;

    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : 6379,
      ...(password ? { password } : {}),
      ...(isTLS ? { tls: {} } : {}),
    };
  }

  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    ...(process.env.REDIS_PASS ? { password: process.env.REDIS_PASS } : {}),
  };
}

export const emailQueue = new Queue("emailQueue", {
  connection: redisConnectionFromEnv(),
});
