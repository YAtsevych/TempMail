import { v4 as uuidv4 } from "uuid";
import pool from "../db";
import { setWithTTL, get, del } from "./redisService";

const INBOX_TTL = 60 * 60; // 1 час в секундах

// Типы
export interface Inbox {
  id: string;
  address: string;
  token: string;
  created_at: Date;
  expires_at: Date;
  last_active: Date;
}

// Генерация случайного email адреса
const generateAddress = (): string => {
  const firstNames = [
    "James",
    "John",
    "Robert",
    "Michael",
    "William",
    "David",
    "Richard",
    "Joseph",
    "Thomas",
    "Charles",
    "Christopher",
    "Daniel",
    "Matthew",
    "Anthony",
    "Mark",
    "Donald",
    "Steven",
    "Paul",
    "Andrew",
    "Joshua",
    "Kenneth",
    "Kevin",
    "Brian",
    "George",
    "Edward",
    "Ronald",
    "Timothy",
    "Jason",
    "Jeffrey",
    "Ryan",
    "Jacob",
    "Gary",
    "Nicholas",
    "Eric",
    "Stephen",
    "Jonathan",
    "Larry",
    "Justin",
    "Scott",
    "Brandon",
  ];

  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Gonzalez",
    "Wilson",
    "Anderson",
    "Thomas",
    "Taylor",
    "Moore",
    "Jackson",
    "Martin",
    "Lee",
    "Perez",
    "Thompson",
    "White",
    "Harris",
    "Sanchez",
    "Clark",
    "Ramirez",
    "Lewis",
    "Robinson",
    "Walker",
    "Young",
    "Allen",
    "King",
    "Wright",
    "Scott",
    "Torres",
    "Nguyen",
    "Hill",
    "Flores",
  ];
  const firstN = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastN = lastNames[Math.floor(Math.random() * lastNames.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${firstN}${lastN}${num}@tempmail.dev`;
};

// Создать новый inbox
export const createInbox = async (): Promise<Inbox> => {
  const address = generateAddress();
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + INBOX_TTL * 1000);

  const result = await pool.query<Inbox>(
    `INSERT INTO inboxes (address, token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [address, token, expiresAt],
  );

  const inbox = result.rows[0];

  // Кешируем в Redis
  await setWithTTL(`inbox:${address}`, inbox, INBOX_TTL);

  return inbox;
};

// Получить inbox по адресу
export const getInboxByAddress = async (
  address: string,
): Promise<Inbox | null> => {
  // 1. Проверяем Redis
  const cached = await get<Inbox>(`inbox:${address}`);
  if (cached) {
    console.log("⚡ Inbox from Redis cache");
    return cached;
  }

  // 2. Берём из PostgreSQL
  const result = await pool.query<Inbox>(
    `SELECT * FROM inboxes WHERE address = $1 AND expires_at > NOW()`,
    [address],
  );

  if (result.rows.length === 0) return null;

  const inbox = result.rows[0];

  // 3. Сохраняем в Redis
  await setWithTTL(`inbox:${address}`, inbox, INBOX_TTL);

  return inbox;
};

// Получить inbox по токену
export const getInboxByToken = async (token: string): Promise<Inbox | null> => {
  const result = await pool.query<Inbox>(
    `SELECT * FROM inboxes WHERE token = $1 AND expires_at > NOW()`,
    [token],
  );

  if (result.rows.length === 0) return null;
  return result.rows[0];
};

// Удалить inbox
export const deleteInbox = async (address: string): Promise<void> => {
  await pool.query(`DELETE FROM inboxes WHERE address = $1`, [address]);
  await del(`inbox:${address}`);
};
