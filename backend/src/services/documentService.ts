import { env } from "../config/env";
import {
  createDocument,
  DocumentRecord,
  findDocumentByContentHash,
  findDocumentById,
  getDocumentsByUserId,
  getFlaggedDocuments
} from "../models/documentModel";
import {
  getCandidateDocumentIdsByHashes,
  getFingerprintsByDocumentIds,
  insertFingerprints
} from "../models/fingerprintModel";
import {
  getAverageSimilarity,
  getDocumentsCount,
  getFingerprintsCount,
  getFlaggedDocumentsCount,
  getUsersCount
} from "../models/adminModel";
import { AppError } from "../utils/AppError";
import { getContentHash } from "../utils/crypto";
import { generateFingerprintHashes, getJaccardSimilarity } from "../utils/textProcessing";

type UploadResult = {
  documentId: number;
  similarityScore: number;
  matchedDocumentId: number | null;
  flagged: boolean;
  wordsCount: number;
  fingerprintsCount: number;
};

export const processAndStoreDocument = async (
  userId: number,
  originalText: string
): Promise<UploadResult> => {
  const contentHash = getContentHash(originalText);
  const duplicate = await findDocumentByContentHash(contentHash);

  if (duplicate) {
    throw new AppError("Duplicate document upload detected", 409);
  }

  const { cleanedText, wordsCount, hashes } = generateFingerprintHashes(originalText, env.kGramSize);

  if (wordsCount < env.kGramSize) {
    throw new AppError(`Document must contain at least ${env.kGramSize} words`, 400);
  }

  const hashArray = [...hashes];
  const candidateDocIds = await getCandidateDocumentIdsByHashes(hashArray);
  const candidateHashMap = await getFingerprintsByDocumentIds(candidateDocIds);

  let bestScore = 0;
  let bestMatchId: number | null = null;

  for (const [docId, existingHashes] of candidateHashMap.entries()) {
    const score = getJaccardSimilarity(hashes, existingHashes);
    if (score > bestScore) {
      bestScore = score;
      bestMatchId = docId;
    }
  }

  const flagged = bestScore >= env.similarityThreshold;

  const doc = await createDocument({
    userId,
    originalText,
    cleanedText,
    contentHash,
    similarityScore: bestScore,
    matchedDocumentId: bestMatchId,
    isFlagged: flagged
  });

  await insertFingerprints(doc.id, hashArray);

  return {
    documentId: doc.id,
    similarityScore: bestScore,
    matchedDocumentId: bestMatchId,
    flagged,
    wordsCount,
    fingerprintsCount: hashArray.length
  };
};

export const getUserDocumentHistory = async (userId: number) => {
  const docs = await getDocumentsByUserId(userId);
  return docs.map((doc: DocumentRecord) => ({
    id: doc.id,
    similarityScore: doc.similarity_score,
    matchedDocumentId: doc.matched_document_id,
    flagged: doc.is_flagged,
    createdAt: doc.created_at
  }));
};

export const getDocumentByIdForUser = async (documentId: number, userId: number) => {
  const doc = await findDocumentById(documentId);
  if (!doc || doc.user_id !== userId) {
    throw new AppError("Document not found", 404);
  }

  return {
    id: doc.id,
    originalText: doc.original_text,
    similarityScore: doc.similarity_score,
    matchedDocumentId: doc.matched_document_id,
    flagged: doc.is_flagged,
    createdAt: doc.created_at
  };
};

export const getFlaggedDocumentsReport = async () => {
  const docs = await getFlaggedDocuments();
  return docs.map((doc: DocumentRecord) => ({
    id: doc.id,
    userId: doc.user_id,
    similarityScore: doc.similarity_score,
    matchedDocumentId: doc.matched_document_id,
    createdAt: doc.created_at
  }));
};

export const getAdminStats = async () => {
  const [usersCount, documentsCount, flaggedDocumentsCount, fingerprintsCount, averageSimilarity] =
    await Promise.all([
      getUsersCount(),
      getDocumentsCount(),
      getFlaggedDocumentsCount(),
      getFingerprintsCount(),
      getAverageSimilarity()
    ]);

  return {
    usersCount,
    documentsCount,
    flaggedDocumentsCount,
    fingerprintsCount,
    averageSimilarity
  };
};
