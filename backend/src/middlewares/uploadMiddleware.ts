import multer from "multer";
import { env } from "../config/env";

const allowedMimeTypes = ["text/plain", "text/markdown"];

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(new Error("Invalid file type. Please upload .txt or .md file"));
    }
    callback(null, true);
  }
});
