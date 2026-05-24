// Створення та пошук інбоксів в БД

import { v4 as uuidv4 } from "uuid";
import pool from "../db";

const INBOX_TTL = 60 * 60; // 1 година

export interface Inbox {
  id: string;
  address: string;
  token: string;
  created_at: Date;
  expires_at: Date;
  last_active: Date;
  inbox_address: string;
}

// Генеруємо людиноподібний email типу JamesSmith4231@tempmailbox.uk
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

  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${first}${last}${num}@tempmailbox.uk`;
};

export const createInbox = async (): Promise<Inbox> => {
  const inbox_address = generateAddress();
  const address = inbox_address.toLowerCase();
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + INBOX_TTL * 1000);

  const result = await pool.query<Inbox>(
    `INSERT INTO inboxes (address, token, expires_at, inbox_address)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [address, token, expiresAt, inbox_address],
  );

  return result.rows[0];
};

// Шукаємо лише активні інбокси (expires_at > зараз)
export const getInboxByAddress = async (
  address: string,
): Promise<Inbox | null> => {
  const result = await pool.query<Inbox>(
    `SELECT * FROM inboxes WHERE address = $1 AND expires_at > NOW()`,
    [address],
  );
  return result.rows[0] ?? null;
};

export const getInboxByToken = async (token: string): Promise<Inbox | null> => {
  const result = await pool.query<Inbox>(
    `SELECT * FROM inboxes WHERE token = $1 AND expires_at > NOW()`,
    [token],
  );
  return result.rows[0] ?? null;
};

export const deleteInbox = async (address: string): Promise<void> => {
  await pool.query(`DELETE FROM inboxes WHERE address = $1`, [address]);
};
