import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "JWT_SECRET"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  similarityThreshold: Number(process.env.SIMILARITY_THRESHOLD ?? 40),
  kGramSize: Number(process.env.K_GRAM_SIZE ?? 3),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 2)
};
