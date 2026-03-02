import { Router } from "express";
import {
  flaggedController,
  getDocumentController,
  historyController,
  uploadDocumentController
} from "../controllers/documentController";
import { authenticate } from "../middlewares/authMiddleware";
import { uploadLimiter } from "../middlewares/rateLimiter";
import { upload } from "../middlewares/uploadMiddleware";
import { asyncHandler } from "../utils/asyncHandler";

const documentRouter = Router();

documentRouter.post(
  "/upload",
  authenticate,
  uploadLimiter,
  upload.single("file"),
  asyncHandler(uploadDocumentController)
);
documentRouter.get("/history", authenticate, asyncHandler(historyController));
documentRouter.get("/:id", authenticate, asyncHandler(getDocumentController));

const adminRouter = Router();
adminRouter.get("/flagged", authenticate, asyncHandler(flaggedController));

export { adminRouter, documentRouter };
