import Redis from "ioredis";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redis.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
});

// Сохранить с TTL (секунды)
export const setWithTTL = async (
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> => {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
};

// Получить данные
export const get = async <T>(key: string): Promise<T | null> => {
  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data) as T;
};

// Удалить данные
export const del = async (key: string): Promise<void> => {
  await redis.del(key);
};

// Проверить существование
export const exists = async (key: string): Promise<boolean> => {
  const result = await redis.exists(key);
  return result === 1;
};

// Обновить TTL
export const refreshTTL = async (
  key: string,
  ttlSeconds: number,
): Promise<void> => {
  await redis.expire(key, ttlSeconds);
};

export default redis;
