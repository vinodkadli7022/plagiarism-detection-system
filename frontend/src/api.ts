import type { ApiResponse, AuthResponse, DocumentDetails, HistoryItem, UploadResult } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

const toErrorMessage = async (response: Response) => {
  try {
    const parsed = await response.json();
    return parsed?.message ?? "Something went wrong";
  } catch {
    return "Something went wrong";
  }
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }

  const parsed = (await response.json()) as ApiResponse<T>;
  return parsed.data;
}

export const api = {
  async register(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return parseResponse<AuthResponse>(response);
  },

  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return parseResponse<AuthResponse>(response);
  },

  async uploadDocument(file: File, token: string) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    return parseResponse<UploadResult>(response);
  },

  async getHistory(token: string) {
    const response = await fetch(`${API_BASE_URL}/documents/history`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });

    return parseResponse<HistoryItem[]>(response);
  },

  async getDocumentById(id: number, token: string) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });

    return parseResponse<DocumentDetails>(response);
  }
};
