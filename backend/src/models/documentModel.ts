import { pool } from "../config/db";

export type DocumentRecord = {
  id: number;
  user_id: number;
  original_text: string;
  cleaned_text: string;
  content_hash: string;
  similarity_score: number;
  matched_document_id: number | null;
  is_flagged: boolean;
  created_at: string;
};

type CreateDocumentPayload = {
  userId: number;
  originalText: string;
  cleanedText: string;
  contentHash: string;
  similarityScore: number;
  matchedDocumentId: number | null;
  isFlagged: boolean;
};

export const findDocumentByContentHash = async (contentHash: string, userId: number) => {
  const query = `
    SELECT id, user_id, original_text, cleaned_text, content_hash, similarity_score, matched_document_id, is_flagged, created_at
    FROM documents
    WHERE content_hash = $1
      AND user_id = $2
    LIMIT 1
  `;
  const result = await pool.query<DocumentRecord>(query, [contentHash, userId]);
  return result.rows[0] ?? null;
};

export const createDocument = async (payload: CreateDocumentPayload) => {
  const query = `
    INSERT INTO documents (
      user_id,
      original_text,
      cleaned_text,
      content_hash,
      similarity_score,
      matched_document_id,
      is_flagged
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, user_id, original_text, cleaned_text, content_hash, similarity_score, matched_document_id, is_flagged, created_at
  `;

  const params = [
    payload.userId,
    payload.originalText,
    payload.cleanedText,
    payload.contentHash,
    payload.similarityScore,
    payload.matchedDocumentId,
    payload.isFlagged
  ];

  const result = await pool.query<DocumentRecord>(query, params);
  return result.rows[0];
};

export const findDocumentById = async (id: number) => {
  const query = `
    SELECT id, user_id, original_text, cleaned_text, content_hash, similarity_score, matched_document_id, is_flagged, created_at
    FROM documents
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query<DocumentRecord>(query, [id]);
  return result.rows[0] ?? null;
};

export const getDocumentsByUserId = async (userId: number) => {
  const query = `
    SELECT id, user_id, original_text, cleaned_text, content_hash, similarity_score, matched_document_id, is_flagged, created_at
    FROM documents
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;
  const result = await pool.query<DocumentRecord>(query, [userId]);
  return result.rows;
};

export const getFlaggedDocuments = async () => {
  const query = `
    SELECT id, user_id, original_text, cleaned_text, content_hash, similarity_score, matched_document_id, is_flagged, created_at
    FROM documents
    WHERE is_flagged = true
    ORDER BY similarity_score DESC, created_at DESC
  `;
  const result = await pool.query<DocumentRecord>(query);
  return result.rows;
};
