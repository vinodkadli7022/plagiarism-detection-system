import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserPassword,
  updateUserProfile
} from "../models/userModel";
import { AppError } from "../utils/AppError";

const SALT_ROUNDS = 10;

const getDefaultDisplayName = (email: string) => {
  const base = email.split("@")[0] ?? "User";
  return base.replace(/[._-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const makeToken = (userId: number, email: string) => {
  return jwt.sign({ userId, email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"]
  });
};

export const register = async (email: string, password: string) => {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await createUser(email, passwordHash, getDefaultDisplayName(email));
  const token = makeToken(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      plan: user.plan
    },
    token
  };
};

export const login = async (email: string, password: string) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw new AppError("Invalid credentials", 401);
  }

  const token = makeToken(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      plan: user.plan
    },
    token
  };
};

export const getProfile = async (userId: number) => {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    plan: user.plan,
    createdAt: user.created_at
  };
};

export const updateProfile = async (userId: number, displayName: string, plan: string) => {
  const user = await updateUserProfile(userId, displayName, plan);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    plan: user.plan,
    createdAt: user.created_at
  };
};

export const changePassword = async (
  userId: number,
  currentPassword: string,
  newPassword: string
) => {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!validPassword) {
    throw new AppError("Current password is incorrect", 400);
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updateUserPassword(userId, newHash);

  return {
    success: true
  };
};
