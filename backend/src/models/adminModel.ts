import { pool } from "../config/db";

type CountRow = {
  count: string;
};

type AvgRow = {
  avg_similarity: string | null;
};

export const getUsersCount = async () => {
  const result = await pool.query<CountRow>("SELECT COUNT(*)::text AS count FROM users");
  return Number(result.rows[0]?.count ?? 0);
};

export const getDocumentsCount = async () => {
  const result = await pool.query<CountRow>("SELECT COUNT(*)::text AS count FROM documents");
  return Number(result.rows[0]?.count ?? 0);
};

export const getFlaggedDocumentsCount = async () => {
  const result = await pool.query<CountRow>(
    "SELECT COUNT(*)::text AS count FROM documents WHERE is_flagged = true"
  );
  return Number(result.rows[0]?.count ?? 0);
};

export const getFingerprintsCount = async () => {
  const result = await pool.query<CountRow>("SELECT COUNT(*)::text AS count FROM fingerprints");
  return Number(result.rows[0]?.count ?? 0);
};

export const getAverageSimilarity = async () => {
  const result = await pool.query<AvgRow>(
    "SELECT ROUND(COALESCE(AVG(similarity_score), 0)::numeric, 2)::text AS avg_similarity FROM documents"
  );

  return Number(result.rows[0]?.avg_similarity ?? 0);
};
