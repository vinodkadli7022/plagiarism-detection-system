import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "./api";
import type { DocumentDetails, HistoryItem, UploadResult } from "./types";

function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [latestResult, setLatestResult] = useState<UploadResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  const resetAlerts = () => {
    setMessage("");
    setError("");
  };

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetAlerts();
    setLoading(true);

    try {
      const data =
        mode === "login"
          ? await api.login(email.trim(), password)
          : await api.register(email.trim(), password);

      setToken(data.token);
      setCurrentEmail(data.user.email);
      setMessage(mode === "login" ? "Login successful" : "Registration successful");
      setEmail("");
      setPassword("");
      const fetchedHistory = await api.getHistory(data.token);
      setHistory(fetchedHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || !token) {
      return;
    }

    resetAlerts();
    setLoading(true);

    try {
      const result = await api.uploadDocument(selectedFile, token);
      setLatestResult(result);
      setSelectedFile(null);
      setMessage("Document analyzed successfully");
      const fetchedHistory = await api.getHistory(token);
      setHistory(fetchedHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchDocument = async (id: number) => {
    if (!token) {
      return;
    }

    resetAlerts();
    setLoading(true);

    try {
      const documentData = await api.getDocumentById(id, token);
      setSelectedDocument(documentData);
      setMessage(`Loaded document #${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch document");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentEmail("");
    setHistory([]);
    setSelectedDocument(null);
    setLatestResult(null);
    setMessage("Logged out");
    setError("");
  };

  return (
    <main className="page">
      <section className="card hero">
        <h1>Document Similarity & Plagiarism Detection</h1>
        <p>
          Resume-ready full-stack system using k-gram hashing + Jaccard similarity with JWT secured
          APIs.
        </p>
      </section>

      {message ? <p className="alert success">{message}</p> : null}
      {error ? <p className="alert error">{error}</p> : null}

      {!isAuthenticated ? (
        <section className="card">
          <div className="mode-toggle">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth} className="form-grid">
            <input
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Enter password (min 6 chars)"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="row-between">
              <h2>Welcome, {currentEmail}</h2>
              <button type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>
            <form onSubmit={handleUpload} className="form-grid">
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                }}
                required
              />
              <button type="submit" disabled={loading || !selectedFile}>
                {loading ? "Analyzing..." : "Upload & Check Similarity"}
              </button>
            </form>
          </section>

          {latestResult ? (
            <section className="card">
              <h2>Latest Analysis Result</h2>
              <div className="metrics">
                <article>
                  <span>Similarity</span>
                  <strong>{latestResult.similarityScore}%</strong>
                </article>
                <article>
                  <span>Status</span>
                  <strong>{latestResult.flagged ? "Flagged" : "Clean"}</strong>
                </article>
                <article>
                  <span>Matched Doc</span>
                  <strong>{latestResult.matchedDocumentId ?? "N/A"}</strong>
                </article>
                <article>
                  <span>Fingerprints</span>
                  <strong>{latestResult.fingerprintsCount}</strong>
                </article>
              </div>
            </section>
          ) : null}

          <section className="card">
            <h2>Upload History</h2>
            {history.length === 0 ? (
              <p className="muted">No uploads yet.</p>
            ) : (
              <div className="history-list">
                {history.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="history-item"
                    onClick={() => handleFetchDocument(item.id)}
                  >
                    <span>Doc #{item.id}</span>
                    <span>{item.similarityScore}%</span>
                    <span>{item.flagged ? "Flagged" : "Clean"}</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedDocument ? (
            <section className="card">
              <h2>Document #{selectedDocument.id}</h2>
              <p>
                Similarity: <strong>{selectedDocument.similarityScore}%</strong> | Matched Document:
                <strong> {selectedDocument.matchedDocumentId ?? "N/A"}</strong>
              </p>
              <textarea readOnly value={selectedDocument.originalText} rows={8} />
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

export default App;
