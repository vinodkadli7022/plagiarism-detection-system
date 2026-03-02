import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { createUser, findUserByEmail } from "../models/userModel";
import { AppError } from "../utils/AppError";

const SALT_ROUNDS = 10;

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
  const user = await createUser(email, passwordHash);
  const token = makeToken(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email
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
      email: user.email
    },
    token
  };
};
