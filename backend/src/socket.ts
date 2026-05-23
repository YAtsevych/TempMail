import { Server } from "socket.io";
import Redis from "ioredis";

const CHANNEL = "new_email"; // имя канала Pub/Sub

let _io: Server | null = null;

export function initIo(server: Server): void {
  _io = server;

  // Подписчик — отдельный Redis-клиент (ioredis требует отдельного соединения для subscribe)
  const subscriber = new Redis(
    process.env.REDIS_URL || "redis://localhost:6379",
  );

  subscriber.subscribe(CHANNEL, (err) => {
    if (err) console.error("[Redis] Subscribe error:", err);
    else console.log(`[Redis] Subscribed to channel: ${CHANNEL}`);
  });

  // Когда воркер публикует событие — emit в нужную комнату
  subscriber.on("message", (_channel, message) => {
    try {
      const { room, payload } = JSON.parse(message);
      _io!.to(room).emit("NEW_EMAIL", payload);
      console.log(`[WS] Emitted NEW_EMAIL to ${room}`);
    } catch (e) {
      console.error("[Redis] Failed to parse message:", e);
    }
  });
}

// Публикатор — используется в воркере
export function createPublisher(): Redis {
  return new Redis(process.env.REDIS_URL || "redis://localhost:6379");
}

export const PUBSUB_CHANNEL = CHANNEL;
