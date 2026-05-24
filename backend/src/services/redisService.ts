// Підключення до Redis і базові операції з кешем

import Redis from "ioredis";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redis.on("ready", () => console.log("[redis] ✅ Connected"));
redis.on("end", () => console.log("[redis] 🔴 Disconnected"));
redis.on("error", (err) => console.error("[redis] ❌ Error:", err.message));

// Зберегти значення з TTL
export const setWithTTL = async (
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> => {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
};

// Отримати значення
export const get = async <T>(key: string): Promise<T | null> => {
  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data) as T;
};

// Видалити ключ
export const del = async (key: string): Promise<void> => {
  await redis.del(key);
};

// Перевірити чи існує ключ
export const exists = async (key: string): Promise<boolean> => {
  const result = await redis.exists(key);
  return result === 1;
};

// Оновити час життя ключа
export const refreshTTL = async (
  key: string,
  ttlSeconds: number,
): Promise<void> => {
  await redis.expire(key, ttlSeconds);
};

// Token Bucket — атомарний Lua-скрипт щоб не було race condition
// ρ=10 токенів/сек, β=50 burst — параметри з диплому (Розділ 1.3)
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

-- Перший запит з цього IP — ініціалізуємо відро
if tokens == nil then
  tokens = capacity
  lastRefill = now
end

-- Поповнюємо токени пропорційно до часу що минув
local elapsed = math.max(0, now - lastRefill)
tokens = math.min(capacity, tokens + elapsed * rate)

if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
  redis.call('EXPIRE', key, ttl)
  return 1
else
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
  redis.call('EXPIRE', key, ttl)
  return 0
end
`;

const RATE = 10; // токенів/сек
const CAPACITY = 50; // максимум в відрі (burst)
const TTL = 60; // секунд — потім ключ сам видаляється

// Перевіряє чи пропустити запит з цього IP
export async function checkRateLimit(
  ip: string,
): Promise<{ allowed: boolean }> {
  const key = `ratelimit:ip:${ip}`;
  const now = Date.now() / 1000;

  const result = (await redis.eval(
    TOKEN_BUCKET_SCRIPT,
    1,
    key,
    now,
    RATE,
    CAPACITY,
    TTL,
  )) as number;

  const allowed = result === 1;

  if (!allowed) {
    console.log(`[ratelimit] 🚫 Blocked | ip=${ip}`);
  }

  return { allowed };
}

// Лічильники метрик — зберігаємо в Redis hash
const METRICS_KEY = "metrics:counters";

export async function incrementMetric(field: string, by = 1): Promise<void> {
  await redis.hincrby(METRICS_KEY, field, by);
}

export async function getMetricCounters(): Promise<Record<string, number>> {
  const raw = await redis.hgetall(METRICS_KEY);
  if (!raw) return {};
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Number(v)]),
  );
}

export default redis;
