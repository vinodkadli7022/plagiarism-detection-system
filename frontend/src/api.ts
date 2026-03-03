import type {
  AdminStats,
  ApiResponse,
  AuthResponse,
  DocumentDetails,
  HistoryItem,
  UserProfile,
  UploadResult
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5050/api";

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
  },

  async getAdminStats(token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/stats`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });

    return parseResponse<AdminStats>(response);
  },

  async getProfile(token: string) {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });

    return parseResponse<UserProfile>(response);
  },

  async updateProfile(token: string, payload: { displayName: string; plan: string }) {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return parseResponse<UserProfile>(response);
  },

  async changePassword(
    token: string,
    payload: { currentPassword: string; newPassword: string; confirmPassword: string }
  ) {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return parseResponse<{ success: boolean }>(response);
  }
};
