import { Request, Response } from "express";
import { login, register } from "../services/authService";

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
