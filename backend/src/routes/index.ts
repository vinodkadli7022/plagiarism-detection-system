import { Router } from "express";
import { adminRouter, documentRouter } from "./documentRoutes";
import { authRouter } from "./authRoutes";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/documents", documentRouter);
apiRouter.use("/admin", adminRouter);

export { apiRouter };
