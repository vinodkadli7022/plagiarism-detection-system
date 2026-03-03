import { Router } from "express";
import { z } from "zod";
import {
  changePasswordController,
  getProfileController,
  loginController,
  registerController,
  updateProfileController
} from "../controllers/authController";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middlewares/validate";
import { authLimiter } from "../middlewares/rateLimiter";
import { authenticate } from "../middlewares/authMiddleware";

const authRouter = Router();

const authSchema = z.object({
  email: z.email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(80),
  plan: z.enum(["Premium", "Pro", "Enterprise"])
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, "Current password must be at least 6 characters"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters")
  })
  .refine((payload) => payload.newPassword === payload.confirmPassword, {
    message: "New password and confirm password must match",
    path: ["confirmPassword"]
  });

authRouter.post("/register", authLimiter, validateBody(authSchema), asyncHandler(registerController));
authRouter.post("/login", authLimiter, validateBody(authSchema), asyncHandler(loginController));
authRouter.get("/me", authenticate, asyncHandler(getProfileController));
authRouter.patch(
  "/me",
  authenticate,
  validateBody(profileSchema),
  asyncHandler(updateProfileController)
);
authRouter.patch(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(changePasswordController)
);

export { authRouter };
