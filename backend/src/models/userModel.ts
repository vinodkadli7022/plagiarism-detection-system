import { pool } from "../config/db";

export type UserRecord = {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
};

export const findUserByEmail = async (email: string) => {
  const query = `SELECT id, email, password_hash, created_at FROM users WHERE email = $1 LIMIT 1`;
  const result = await pool.query<UserRecord>(query, [email]);
  return result.rows[0] ?? null;
};

export const createUser = async (email: string, passwordHash: string) => {
  const query = `
    INSERT INTO users (email, password_hash)
    VALUES ($1, $2)
    RETURNING id, email, password_hash, created_at
  `;
  const result = await pool.query<UserRecord>(query, [email, passwordHash]);
  return result.rows[0];
};
