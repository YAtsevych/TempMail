// backend/src/socket.ts
// Singleton Socket.io + Redis Pub/Sub для міжпроцесної доставки подій.
//
// Архітектура:
//   Worker process  →  publisher.publish("new_email", JSON)
//                               ↓ Redis Pub/Sub
//   index.ts        →  subscriber.on("message") → io.to(room).emit("NEW_EMAIL")
//                               ↓ WebSocket
//                      Браузер клієнта
//
// Причина розділення: Worker і Express — окремі процеси (Node.js).
// Спільна пам'ять недоступна → Redis Pub/Sub як шина подій.

import { Server } from "socket.io";
import Redis from "ioredis";

const CHANNEL = "new_email";

let _io: Server | null = null;

/**
 * Ініціалізує Socket.io singleton та Redis-підписника.
 * Викликається один раз при старті сервера (index.ts).
 */
export function initIo(server: Server): void {
  _io = server;

  const subscriber = new Redis(
    process.env.REDIS_URL || "redis://localhost:6379",
  );

  subscriber.subscribe(CHANNEL, (err) => {
    if (err) {
      console.error("[socket] ❌ Redis subscribe failed:", err.message);
    } else {
      console.log(`[socket] ✅ Subscribed to Redis channel "${CHANNEL}"`);
    }
  });

  subscriber.on("message", (_channel, message) => {
    try {
      const { room, payload } = JSON.parse(message);
      _io!.to(room).emit("NEW_EMAIL", payload);
      // Лог доставки
      console.log(
        `[socket] → NEW_EMAIL sent | room=${room} | subject="${payload.subject}"`,
      );
    } catch (e) {
      console.error(
        "[socket] ❌ Failed to parse Pub/Sub message:",
        (e as Error).message,
      );
    }
  });

  subscriber.on("error", (err) => {
    console.error("[socket] ❌ Redis subscriber error:", err.message);
  });
}

/**
 * Створює окремий Redis-клієнт для публікації подій.
 * Використовується у Worker процесі (queueWorker.ts).
 * ioredis забороняє використовувати один клієнт для subscribe і publish.
 */
export function createPublisher(): Redis {
  const publisher = new Redis(
    process.env.REDIS_URL || "redis://localhost:6379",
  );

  publisher.on("error", (err) => {
    console.error("[socket:publisher] ❌ Redis error:", err.message);
  });

  return publisher;
}

export const PUBSUB_CHANNEL = CHANNEL;
