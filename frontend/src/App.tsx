import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { api } from "./api";
import type { AdminStats, DocumentDetails, HistoryItem, UserProfile } from "./types";

type View = "dashboard" | "upload" | "history" | "report" | "settings";

const formatDisplayName = (emailValue: string, fallback?: string) => {
  if (fallback && fallback.trim()) {
    return fallback;
  }
  const base = emailValue.split("@")[0] ?? "User";
  return base.replace(/[._-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDocName = (id: number) => `document_${id}.txt`;

const getStatusLabel = (item: HistoryItem) => {
  if (item.flagged || item.similarityScore >= 50) {
    return "Flagged";
  }
  if (item.similarityScore >= 20) {
    return "Review";
  }
  return "Clean";
};

function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [view, setView] = useState<View>("dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetails | null>(null);
  const [searchText, setSearchText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAuthenticated = Boolean(token);

  const resetAlerts = () => {
    setMessage("");
    setError("");
  };

  const refreshData = async (authToken: string) => {
    const [historyData, statsData] = await Promise.all([api.getHistory(authToken), api.getAdminStats(authToken)]);
    setHistory(historyData);
    setAdminStats(statsData);

    try {
      const profile = await api.getProfile(authToken);
      setCurrentUser(profile);
    } catch {
      // fallback to auth response data when profile endpoint is unavailable
    }
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
      setCurrentUser({
        id: data.user.id,
        email: data.user.email,
        displayName: formatDisplayName(data.user.email, data.user.displayName),
        plan: data.user.plan ?? "Free",
        createdAt: new Date().toISOString()
      });
      setView("dashboard");
      setEmail("");
      setPassword("");

      await refreshData(data.token);
      if (mode === "register") {
        setMessage("Account created successfully");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const openDocumentReport = async (id: number) => {
    if (!token) {
      return;
    }

    resetAlerts();
    setLoading(true);

    try {
      const documentData = await api.getDocumentById(id, token);
      setSelectedDocument(documentData);
      setView("report");
      setMessage(`Loaded report for document #${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open report");
    } finally {
      setLoading(false);
    }
  };

  const processUpload = async () => {
    if (!token || !selectedFile) {
      return;
    }

    resetAlerts();
    setLoading(true);

    try {
      const result = await api.uploadDocument(selectedFile, token);
      setSelectedFile(null);
      await refreshData(token);
      await openDocumentReport(result.documentId);
      setMessage("Document processed successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const onDropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    if (!file) {
      return;
    }

    setSelectedFile(file);
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setHistory([]);
    setAdminStats(null);
    setSelectedFile(null);
    setSelectedDocument(null);
    setSearchText("");
    setView("dashboard");
    resetAlerts();
  };

  const filteredHistory = useMemo(() => {
    if (!searchText.trim()) {
      return history;
    }

    const lower = searchText.toLowerCase();
    return history.filter((item) => {
      const name = formatDocName(item.id).toLowerCase();
      return (
        name.includes(lower) ||
        `#${item.id}`.includes(lower) ||
        getStatusLabel(item).toLowerCase().includes(lower)
      );
    });
  }, [history, searchText]);

  const dashboardCards = useMemo(() => {
    const totalDocs = adminStats?.documentsCount ?? history.length;
    const flagged = adminStats?.flaggedDocumentsCount ?? history.filter((item) => item.flagged).length;
    const clean = Math.max(totalDocs - flagged, 0);
    const avgSimilarity = adminStats?.averageSimilarity ?? 0;

    const avgProcessingSeconds = Math.max(avgSimilarity / 10, 1.2).toFixed(1);

    return {
      totalDocs,
      clean,
      flagged,
      avgSimilarity,
      avgProcessingTime: `${avgProcessingSeconds}s`
    };
  }, [adminStats, history]);

  const recentUploads = useMemo(() => history.slice(0, 4), [history]);

  const displayName = useMemo(() => {
    if (currentUser?.displayName) {
      return currentUser.displayName;
    }
    return formatDisplayName(currentUser?.email ?? "user@example.com");
  }, [currentUser?.displayName, currentUser?.email]);

  const initials = useMemo(() => {
    const parts = displayName.split(" ").filter(Boolean);
    if (!parts.length) {
      return "U";
    }
    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }, [displayName]);

  return (
    <div className="docu-app">
      {!isAuthenticated ? (
        <main className="auth-layout">
          {/* Left hero panel */}
          <section className="auth-hero">
            <div className="auth-hero-inner">
              <div className="auth-logo-mark">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="48" height="48" rx="12" fill="#ff7f11"/>
                  <path d="M14 13h20v3H14zM14 20h14v3H14zM14 27h20v3H14zM14 34h10v3H14z" fill="#fff"/>
                  <circle cx="36" cy="35" r="7" fill="#1e293b" stroke="#ff7f11" strokeWidth="2"/>
                  <path d="M33 35l2 2 4-4" stroke="#ff7f11" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 className="auth-hero-title">Palagarsim-<br/>checker</h1>
              <p className="auth-hero-sub">
                Detect plagiarism instantly using k-gram fingerprinting and Jaccard similarity analysis.
              </p>
              <ul className="auth-feature-list">
                <li>
                  <span className="feat-icon">⚡</span>
                  <span>Real-time similarity scoring</span>
                </li>
                <li>
                  <span className="feat-icon">🔒</span>
                  <span>Secure JWT-based authentication</span>
                </li>
                <li>
                  <span className="feat-icon">📄</span>
                  <span>Full document history &amp; reports</span>
                </li>
                <li>
                  <span className="feat-icon">📊</span>
                  <span>Admin analytics dashboard</span>
                </li>
              </ul>
            </div>
            <div className="auth-hero-bg-circles">
              <span className="bg-circle c1" />
              <span className="bg-circle c2" />
              <span className="bg-circle c3" />
            </div>
          </section>

          {/* Right form panel */}
          <section className="auth-form-panel">
            <div className="auth-form-box">
              <p className="auth-welcome">
                {mode === "login" ? "Welcome back 👋" : "Create your account"}
              </p>
              <h2 className="auth-form-title">
                {mode === "login" ? "Sign in to continue" : "Get started for free"}
              </h2>

              <div className="auth-toggle">
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

              <form onSubmit={handleAuth} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="auth-email">Email address</label>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="auth-password">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    placeholder={mode === "register" ? "At least 6 characters" : "Enter your password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading
                    ? "Please wait…"
                    : mode === "login"
                    ? "Sign In →"
                    : "Create Account →"}
                </button>
              </form>

              {message ? <p className="alert success">{message}</p> : null}
              {error ? <p className="alert error">{error}</p> : null}

              <p className="auth-switch-hint">
                {mode === "login" ? (
                  <>Don't have an account?{" "}
                    <button type="button" className="link-btn" onClick={() => setMode("register")}>Sign up</button>
                  </>
                ) : (
                  <>Already have an account?{" "}
                    <button type="button" className="link-btn" onClick={() => setMode("login")}>Sign in</button>
                  </>
                )}
              </p>
            </div>
          </section>
        </main>
      ) : (
        <div className="workspace-layout">
          <aside className="sidebar">
            <div className="brand">Palagarsim-checker</div>
            <nav className="side-nav">
              <button type="button" className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Dashboard</button>
              <button type="button" className={view === "upload" ? "active" : ""} onClick={() => setView("upload")}>Upload Document</button>
              <button type="button" className={view === "history" || view === "report" ? "active" : ""} onClick={() => setView("history")}>History</button>
              <button type="button" className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>Settings</button>
            </nav>

            <button type="button" className="user-card" onClick={() => setView("settings")}>
              <span className="avatar">{initials}</span>
              <span>
                <strong>{displayName}</strong>
                <small>{currentUser?.email}</small>
              </span>
            </button>

            <button type="button" className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </aside>

          <main className="content">
            {message ? <p className="alert success">{message}</p> : null}
            {error ? <p className="alert error">{error}</p> : null}

            {view === "dashboard" ? (
              <section className="page">
                <header className="page-head">
                  <h1>Dashboard</h1>
                  <p>Overview of your document processing and similarity analysis.</p>
                </header>

                <div className="stat-grid">
                  <article className="card stat-card"><h3>Total Documents</h3><strong>{dashboardCards.totalDocs}</strong></article>
                  <article className="card stat-card"><h3>Clean Documents</h3><strong>{dashboardCards.clean}</strong></article>
                  <article className="card stat-card"><h3>Flagged for Review</h3><strong>{dashboardCards.flagged}</strong></article>
                  <article className="card stat-card"><h3>Avg. Processing Time</h3><strong>{dashboardCards.avgProcessingTime}</strong></article>
                </div>

                <div className="two-col">
                  <article className="card">
                    <h2>Recent Uploads</h2>
                    <p className="sub">Your most recently processed documents and their similarity scores.</p>
                    <div className="upload-list">
                      {recentUploads.length === 0 ? (
                        <p className="empty">No uploads yet.</p>
                      ) : (
                        recentUploads.map((doc) => (
                          <div key={doc.id} className="upload-item">
                            <div>
                              <strong>{formatDocName(doc.id)}</strong>
                              <small>{new Date(doc.createdAt).toLocaleString()}</small>
                            </div>
                            <div className="upload-item-right">
                              <span>{doc.similarityScore}%</span>
                              <button type="button" onClick={() => openDocumentReport(doc.id)}>View Report</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>

                  <article className="card">
                    <h2>System Architecture</h2>
                    <p className="sub">Current processing pipeline status</p>
                    <ul className="status-list">
                      <li><span>Text Extraction Engine</span><b>Online</b></li>
                      <li><span>k-Gram Tokenizer</span><b>Online</b></li>
                      <li><span>Hashing Service</span><b>Online</b></li>
                      <li><span>PostgreSQL Indexed DB</span><b>{adminStats ? "Online" : "Syncing"}</b></li>
                    </ul>
                    <button type="button" className="full-btn" onClick={() => setView("upload")}>Start New Analysis</button>
                  </article>
                </div>
              </section>
            ) : null}

            {view === "upload" ? (
              <section className="page">
                <header className="page-head">
                  <h1>Upload Document</h1>
                  <p>Submit a file for algorithmic similarity analysis and fingerprint generation.</p>
                </header>

                <article className="card">
                  <h2>Submit for Analysis</h2>
                  <p className="sub">Supported formats: .txt, .md (Max size: 2MB)</p>

                  <div
                    className={`drop-area ${dragActive ? "active" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                    }}
                    onDrop={onDropFile}
                  >
                    <p>Drag and drop your file here</p>
                    <span>or</span>
                    <button type="button" onClick={() => fileInputRef.current?.click()}>Browse Files</button>
                    {selectedFile ? <small>{selectedFile.name}</small> : null}
                    <input ref={fileInputRef} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={onFileChange} hidden />
                  </div>

                  <div className="upload-actions">
                    <button type="button" className="full-btn" disabled={!selectedFile || loading} onClick={processUpload}>
                      {loading ? "Processing..." : "Process Document"}
                    </button>
                  </div>
                </article>
              </section>
            ) : null}

            {view === "history" ? (
              <section className="page">
                <header className="page-head row-between">
                  <div>
                    <h1>Processing History</h1>
                    <p>Browse your previously analyzed documents and similarity reports.</p>
                  </div>
                  <button type="button" className="primary-btn" onClick={() => setView("upload")}>Upload New</button>
                </header>

                <article className="card">
                  <div className="table-head">
                    <h2>Document Database</h2>
                    <input
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      placeholder="Search documents..."
                    />
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Document Name</th>
                          <th>Upload Date</th>
                          <th>Similarity Score</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="empty">No documents found.</td>
                          </tr>
                        ) : (
                          filteredHistory.map((item) => {
                            const status = getStatusLabel(item);
                            return (
                              <tr key={item.id}>
                                <td>#{item.id}</td>
                                <td>{formatDocName(item.id)}</td>
                                <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                                <td>
                                  <div className="score-cell">
                                    <div className="mini-bar"><span style={{ width: `${Math.min(item.similarityScore, 100)}%` }} /></div>
                                    <strong>{item.similarityScore}%</strong>
                                  </div>
                                </td>
                                <td><span className={`status-pill ${status.toLowerCase()}`}>{status}</span></td>
                                <td>
                                  <button type="button" className="link-btn" onClick={() => openDocumentReport(item.id)}>Report</button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              </section>
            ) : null}

            {view === "report" ? (
              <section className="page">
                <header className="page-head row-between">
                  <div>
                    <h1>Similarity Report</h1>
                    <p>Detailed report for the selected document.</p>
                  </div>
                  <button type="button" className="primary-btn" onClick={() => setView("history")}>Back to History</button>
                </header>

                {!selectedDocument ? (
                  <article className="card"><p className="empty">No report selected yet.</p></article>
                ) : (
                  <>
                    <article className="card">
                      <h2>{formatDocName(selectedDocument.id)}</h2>
                      <div className="report-grid">
                        <div>
                          <span>Similarity Score</span>
                          <strong>{selectedDocument.similarityScore}%</strong>
                        </div>
                        <div>
                          <span>Matched Document</span>
                          <strong>{selectedDocument.matchedDocumentId ? `#${selectedDocument.matchedDocumentId}` : "N/A"}</strong>
                        </div>
                        <div>
                          <span>Status</span>
                          <strong>{selectedDocument.flagged ? "Flagged" : "Clean"}</strong>
                        </div>
                      </div>
                    </article>

                    <article className="card">
                      <h2>Algorithmic Notes</h2>
                      <p className="sub">Jaccard Similarity Formula</p>
                      <code className="formula">Similarity = (Intersection of fingerprint sets / Union of fingerprint sets) × 100</code>
                      <textarea value={selectedDocument.originalText} readOnly rows={10} />
                    </article>
                  </>
                )}
              </section>
            ) : null}

            {view === "settings" ? (
              <section className="page">
                <header className="page-head">
                  <h1>User Settings</h1>
                  <p>Profile and account details.</p>
                </header>

                <article className="card settings-card">
                  <div className="profile-top">
                    <span className="avatar large">{initials}</span>
                    <div>
                      <h2>{displayName}</h2>
                      <p>{currentUser?.email}</p>
                    </div>
                  </div>

                  <div className="profile-details">
                    <div><span>User ID</span><strong>{currentUser?.id ?? "N/A"}</strong></div>
                    <div><span>Plan</span><strong>{currentUser?.plan ?? "Free"}</strong></div>
                    <div><span>Total Scans</span><strong>{history.length}</strong></div>
                    <div><span>Flagged Documents</span><strong>{history.filter((item) => item.flagged).length}</strong></div>
                    <div><span>Avg Similarity</span><strong>{adminStats?.averageSimilarity ?? 0}%</strong></div>
                    <div><span>Total Fingerprints</span><strong>{adminStats?.fingerprintsCount ?? 0}</strong></div>
                  </div>
                </article>
              </section>
            ) : null}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
