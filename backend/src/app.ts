import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { apiRouter } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFoundHandler";
import { apiLimiter } from "./middlewares/rateLimiter";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use("/api", apiLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy" });
});

app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
