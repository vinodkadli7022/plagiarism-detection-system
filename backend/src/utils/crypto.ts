import crypto from "crypto";

export const getContentHash = (content: string) => {
  return crypto.createHash("sha256").update(content).digest("hex");
};

export const getGramHash = (gram: string) => {
  return crypto.createHash("sha1").update(gram).digest("hex").slice(0, 16);
};
