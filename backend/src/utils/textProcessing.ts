import { getGramHash } from "./crypto";

export const preprocessText = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const getWords = (cleanedText: string) => {
  if (!cleanedText) {
    return [];
  }
  return cleanedText.split(" ").filter(Boolean);
};

export const generateKGrams = (words: string[], k: number) => {
  if (words.length < k) {
    return [];
  }

  const kGrams: string[] = [];
  for (let i = 0; i <= words.length - k; i += 1) {
    kGrams.push(words.slice(i, i + k).join(" "));
  }

  return kGrams;
};

export const generateFingerprintHashes = (text: string, k: number) => {
  const cleanedText = preprocessText(text);
  const words = getWords(cleanedText);
  const grams = generateKGrams(words, k);
  const hashes = new Set<string>();

  grams.forEach((gram) => hashes.add(getGramHash(gram)));

  return {
    cleanedText,
    wordsCount: words.length,
    hashes
  };
};

export const getJaccardSimilarity = (a: Set<string>, b: Set<string>) => {
  const intersectionCount = [...a].filter((item) => b.has(item)).length;
  const unionCount = new Set<string>([...a, ...b]).size;

  if (unionCount === 0) {
    return 0;
  }

  return Number(((intersectionCount / unionCount) * 100).toFixed(2));
};
