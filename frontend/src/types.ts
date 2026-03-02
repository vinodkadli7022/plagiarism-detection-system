export type AuthResponse = {
  user: {
    id: number;
    email: string;
  };
  token: string;
};

export type UploadResult = {
  documentId: number;
  similarityScore: number;
  matchedDocumentId: number | null;
  flagged: boolean;
  wordsCount: number;
  fingerprintsCount: number;
};

export type HistoryItem = {
  id: number;
  similarityScore: number;
  matchedDocumentId: number | null;
  flagged: boolean;
  createdAt: string;
};

export type DocumentDetails = {
  id: number;
  originalText: string;
  similarityScore: number;
  matchedDocumentId: number | null;
  flagged: boolean;
  createdAt: string;
};

export type AdminStats = {
  usersCount: number;
  documentsCount: number;
  flaggedDocumentsCount: number;
  fingerprintsCount: number;
  averageSimilarity: number;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};
