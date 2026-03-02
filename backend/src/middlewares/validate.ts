import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export const validateBody = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.issues[0]?.message ?? "Invalid request data"
      });
    }

    req.body = result.data;
    next();
  };
};
