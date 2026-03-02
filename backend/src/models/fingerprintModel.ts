import { pool } from "../config/db";

type FingerprintRecord = {
  document_id: number;
  hash_value: string;
};

export const insertFingerprints = async (documentId: number, hashes: string[]) => {
  if (!hashes.length) {
    return;
  }

  const values: string[] = [];
  const params: (number | string)[] = [];

  hashes.forEach((hash, index) => {
    const p1 = index * 2 + 1;
    const p2 = index * 2 + 2;
    values.push(`($${p1}, $${p2})`);
    params.push(documentId, hash);
  });

  const query = `
    INSERT INTO fingerprints (document_id, hash_value)
    VALUES ${values.join(",")}
  `;

  await pool.query(query, params);
};

export const getCandidateDocumentIdsByHashes = async (hashes: string[]) => {
  if (!hashes.length) {
    return [];
  }

  const query = `
    SELECT DISTINCT document_id
    FROM fingerprints
    WHERE hash_value = ANY($1::varchar[])
  `;

  const result = await pool.query<{ document_id: number }>(query, [hashes]);
  return result.rows.map((row: { document_id: number }) => row.document_id);
};

export const getFingerprintsByDocumentIds = async (documentIds: number[]) => {
  if (!documentIds.length) {
    return new Map<number, Set<string>>();
  }

  const query = `
    SELECT document_id, hash_value
    FROM fingerprints
    WHERE document_id = ANY($1::int[])
  `;

  const result = await pool.query<FingerprintRecord>(query, [documentIds]);
  const docToHashes = new Map<number, Set<string>>();

  result.rows.forEach((row: FingerprintRecord) => {
    if (!docToHashes.has(row.document_id)) {
      docToHashes.set(row.document_id, new Set<string>());
    }
    docToHashes.get(row.document_id)?.add(row.hash_value);
  });

  return docToHashes;
};
