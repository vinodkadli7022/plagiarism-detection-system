import { Request, Response } from "express";
import {
  getDocumentByIdForUser,
  getFlaggedDocumentsReport,
  getUserDocumentHistory,
  processAndStoreDocument
} from "../services/documentService";
import { AppError } from "../utils/AppError";

export const uploadDocumentController = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError("Unauthorized access", 401);
  }

  if (!req.file) {
    throw new AppError("No file uploaded", 400);
  }

  const text = req.file.buffer.toString("utf-8");
  const result = await processAndStoreDocument(user.userId, text);

  res.status(201).json({
    success: true,
    message: "Document uploaded and analyzed",
    data: result
  });
};

export const historyController = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError("Unauthorized access", 401);
  }

  const history = await getUserDocumentHistory(user.userId);
  res.status(200).json({
    success: true,
    message: "History fetched successfully",
    data: history
  });
};

export const getDocumentController = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError("Unauthorized access", 401);
  }

  const documentId = Number(req.params.id);
  const doc = await getDocumentByIdForUser(documentId, user.userId);

  res.status(200).json({
    success: true,
    message: "Document fetched successfully",
    data: doc
  });
};

export const flaggedController = async (_req: Request, res: Response) => {
  const report = await getFlaggedDocumentsReport();
  res.status(200).json({
    success: true,
    message: "Flagged report fetched successfully",
    data: report
  });
};
