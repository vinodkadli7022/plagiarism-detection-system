import { Router } from "express";
import { z } from "zod";
import { loginController, registerController } from "../controllers/authController";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middlewares/validate";
import { authLimiter } from "../middlewares/rateLimiter";

const authRouter = Router();

const authSchema = z.object({
  email: z.email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

authRouter.post("/register", authLimiter, validateBody(authSchema), asyncHandler(registerController));
authRouter.post("/login", authLimiter, validateBody(authSchema), asyncHandler(loginController));

export { authRouter };
