import { Queue } from "bullmq";

export const emailQueue = new Queue("emailQueue", {
  connection: {
    // Подключение через .env (BULLMQ и ioredis оба понимают этот параметр)
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    // password: process.env.REDIS_PASS, // если есть пароль
  },
});
