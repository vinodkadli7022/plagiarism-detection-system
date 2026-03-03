import { Request, Response } from "express";
import {
  changePassword,
  getProfile,
  login,
  register,
  updateProfile
} from "../services/authService";
import { AppError } from "../utils/AppError";

export const registerController = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await register(email, password);

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: result
  });
};

export const loginController = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await login(email, password);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: result
  });
};

export const getProfileController = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError("Unauthorized access", 401);
  }

  const profile = await getProfile(user.userId);
  res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data: profile
  });
};

export const updateProfileController = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError("Unauthorized access", 401);
  }

  const { displayName, plan } = req.body;
  const profile = await updateProfile(user.userId, displayName, plan);

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: profile
  });
};

export const changePasswordController = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError("Unauthorized access", 401);
  }

  const { currentPassword, newPassword } = req.body;
  await changePassword(user.userId, currentPassword, newPassword);

  res.status(200).json({
    success: true,
    message: "Password changed successfully",
    data: { success: true }
  });
};
