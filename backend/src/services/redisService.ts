import Redis from "ioredis";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

console.log(
  "✅ Redis connected successfully to",
  process.env.REDIS_URL ?? "redis://localhost:6379",
);
redis.on("ready", () => {
  console.log("✅ Redis READY 🟢");
});
redis.on("end", () => {
  console.log("🔴 Redis disconnected.");
});
redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
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

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

-- Читаем текущее состояние ведра
local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

-- Первый запрос с этого IP — инициализируем ведро
if tokens == nil then
  tokens = capacity
  lastRefill = now
end

-- Пополняем токены пропорционально прошедшему времени
-- elapsed * rate = количество новых токенов
local elapsed = math.max(0, now - lastRefill)
local refill = elapsed * rate
tokens = math.min(capacity, tokens + refill)

-- Проверяем: есть ли токен для этого запроса?
if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
  redis.call('EXPIRE', key, ttl)
  return 1  -- разрешено
else
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
  redis.call('EXPIRE', key, ttl)
  return 0  -- отклонено
end
`;

const RATE = 10; // ρ = 10 токенов/сек
const CAPACITY = 50; // β = 50 (burst)
const TTL = 60; // секунд до авто-удаления ключа

/**
 * Проверяет Token Bucket для входящего IP.
 *
 * @param ip — IP отправителя (из X-Sender-IP или req.ip)
 * @returns allowed: true если токен есть, false если ведро пустое
 *
 *   [RATELIMIT] ip=1.2.3.4 allowed=false tokens=0
 */
export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  tokens?: number;
}> {
  const key = `ratelimit:ip:${ip}`;
  const now = Date.now() / 1000; // Unix timestamp в секундах

  const result = (await redis.eval(
    TOKEN_BUCKET_SCRIPT,
    1, // количество ключей
    key, // KEYS[1]
    now, // ARGV[1]
    RATE, // ARGV[2]
    CAPACITY, // ARGV[3]
    TTL, // ARGV[4]
  )) as number;

  const allowed = result === 1;

  // Лог для метрик Розділу 3
  if (!allowed) {
    console.log(`[RATELIMIT] ip=${ip} allowed=false`);
  }

  return { allowed };
}
export default redis;
