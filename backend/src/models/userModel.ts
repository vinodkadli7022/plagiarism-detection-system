import { pool } from "../config/db";

export type UserRecord = {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  plan: string;
  created_at: string;
};

export const findUserByEmail = async (email: string) => {
  const query = `
    SELECT id, email, password_hash, display_name, plan, created_at
    FROM users
    WHERE email = $1
    LIMIT 1
  `;
  const result = await pool.query<UserRecord>(query, [email]);
  return result.rows[0] ?? null;
};

export const findUserById = async (userId: number) => {
  const query = `
    SELECT id, email, password_hash, display_name, plan, created_at
    FROM users
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query<UserRecord>(query, [userId]);
  return result.rows[0] ?? null;
};

export const createUser = async (email: string, passwordHash: string, displayName: string) => {
  const query = `
    INSERT INTO users (email, password_hash, display_name)
    VALUES ($1, $2, $3)
    RETURNING id, email, password_hash, display_name, plan, created_at
  `;
  const result = await pool.query<UserRecord>(query, [email, passwordHash, displayName]);
  return result.rows[0];
};

export const updateUserProfile = async (userId: number, displayName: string, plan: string) => {
  const query = `
    UPDATE users
    SET display_name = $2,
        plan = $3
    WHERE id = $1
    RETURNING id, email, password_hash, display_name, plan, created_at
  `;

  const result = await pool.query<UserRecord>(query, [userId, displayName, plan]);
  return result.rows[0] ?? null;
};

export const updateUserPassword = async (userId: number, passwordHash: string) => {
  const query = `
    UPDATE users
    SET password_hash = $2
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query<{ id: number }>(query, [userId, passwordHash]);
  return result.rows[0] ?? null;
};
