import { pool } from "./db";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[migrate] Running startup migrations...");

    // Add display_name column if missing
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(120);
    `);

    // Add plan column if missing
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(32) NOT NULL DEFAULT 'Premium';
    `);

    // Backfill display_name from email for existing users
    await client.query(`
      UPDATE users SET display_name = split_part(email, '@', 1) WHERE display_name IS NULL;
    `);

    // Remove unique constraint on content_hash so different users can upload same file
    await client.query(`
      ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_content_hash_key;
    `);

    // Add filename column to documents if missing (future-proofing)
    await client.query(`
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS filename VARCHAR(255);
    `);

    console.log("[migrate] All migrations completed successfully.");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
