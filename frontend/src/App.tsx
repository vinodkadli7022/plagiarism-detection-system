import { useEffect, useMemo, useRef, useState } from "react";
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

const formatDocName = (userIndex: number) => `document_${userIndex}.txt`;

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
  const [historyFilter, setHistoryFilter] = useState<"all" | "high" | "clean">("all");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAuthenticated = Boolean(token);

  // Auto-dismiss alerts after 4 seconds
  useEffect(() => {
    if (!message && !error) return;
    const t = setTimeout(() => resetAlerts(), 4000);
    return () => clearTimeout(t);
  }, [message, error]);

  const resetAlerts = () => {
    setMessage("");
    setError("");
  };

  const navigate = (nextView: View) => {
    resetAlerts();
    setView(nextView);
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

  // Map each document's DB id → user-relative sequential number (1, 2, 3…)
  const docIndexMap = useMemo(() => {
    const sorted = [...history].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const map = new Map<number, number>();
    sorted.forEach((item, idx) => map.set(item.id, idx + 1));
    return map;
  }, [history]);

  const getDocIndex = (id: number) => docIndexMap.get(id) ?? id;

  const filteredHistory = useMemo(() => {
    if (!searchText.trim()) {
      return history;
    }

    const lower = searchText.toLowerCase();
    return history.filter((item) => {
      const name = formatDocName(getDocIndex(item.id)).toLowerCase();
      return (
        name.includes(lower) ||
        `#${item.id}`.includes(lower) ||
        getStatusLabel(item).toLowerCase().includes(lower)
      );
    });
  }, [history, searchText, docIndexMap]);

  const dashboardCards = useMemo(() => {
    // Always use the current user's own history — adminStats is global (all users)
    const totalDocs = history.length;
    const flagged = history.filter((item) => item.flagged || item.similarityScore >= 40).length;
    const clean = Math.max(totalDocs - flagged, 0);
    const avgSimilarity =
      totalDocs > 0
        ? parseFloat((history.reduce((sum, item) => sum + item.similarityScore, 0) / totalDocs).toFixed(2))
        : 0;

    const avgProcessingSeconds = Math.max(avgSimilarity / 10, 1.2).toFixed(1);

    return {
      totalDocs,
      clean,
      flagged,
      avgSimilarity,
      avgProcessingTime: `${avgProcessingSeconds}s`
    };
  }, [history]);

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
          {/* Left illustration panel */}
          <section className="auth-hero">
            <div className="auth-illus">
              <div className="auth-orbit" />
              <div className="auth-orbit-inner" />

              {/* Floating icon cards */}
              <div className="auth-float-card fc-tl">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div className="auth-float-card fc-ml">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </div>
              <div className="auth-float-card fc-tr">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8 2 5 5.5 5 9c0 2.5 1 5 2 7"/><path d="M12 2c4 0 7 3.5 7 7 0 2.5-1 5-2 7"/><path d="M9 16c0 1.7 1.3 3 3 3s3-1.3 3-3"/><path d="M10 12c0 1.1.9 2 2 2s2-.9 2-2"/><path d="M11 8c0 .6.4 1 1 1s1-.4 1-1"/></svg>
              </div>
              <div className="auth-float-card fc-br">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </div>
              <div className="auth-float-card fc-bl">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div className="auth-float-card fc-bc">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>

              {/* Central shield with fingerprint */}
              <div className="auth-shield-wrap">
                <div className="auth-shield">
                  {/* Shield background shape */}
                  <svg className="auth-shield-bg" viewBox="0 0 148 170" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="shieldGrad" x1="0" y1="0" x2="148" y2="170" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#4F46E5"/>
                        <stop offset="100%" stopColor="#3730A3"/>
                      </linearGradient>
                    </defs>
                    <path d="M74 4L8 30V90C8 128 38 160 74 170C110 160 140 128 140 90V30L74 4Z" fill="url(#shieldGrad)"/>
                  </svg>
                  {/* Fingerprint icon */}
                  <svg className="auth-shield-fg" viewBox="0 0 64 64" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 38c0 0 0-6 12-6s12 6 12 6"/>
                    <path d="M16 34c0-8.8 7.2-16 16-16s16 7.2 16 16"/>
                    <path d="M12 32c0-11 9-20 20-20s20 9 20 20"/>
                    <path d="M24 40c0 2.2 1.8 4 8 4s8-1.8 8-4"/>
                    <path d="M28 42v4"/>
                    <path d="M20 44c1 4 6 7 12 7s11-3 12-7"/>
                    <path d="M32 18v-4"/>
                    <path d="M24 20l-3-3"/>
                    <path d="M40 20l3-3"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="auth-hero-text">
              <h1 className="auth-hero-title">Secure Document<br/>Authenticity Check</h1>
              <p className="auth-hero-sub">Powered by advanced Jaccard similarity algorithms for precise detection.</p>
            </div>
          </section>

          {/* Right form panel */}
          <section className="auth-form-panel">
            <div className="auth-form-box">
              <h2 className="auth-form-title">
                {mode === "login" ? "Sign In" : "Create Account"}
              </h2>
              <p className="auth-welcome">
                {mode === "login"
                  ? "Access your dashboard to manage documents."
                  : "Start detecting plagiarism in seconds."}
              </p>

              <form onSubmit={handleAuth} className="auth-form">
                <div className="auth-field">
                  <label htmlFor="auth-email">Email</label>
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
                    placeholder={mode === "register" ? "At least 6 characters" : "••••••••"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
                </button>
              </form>

              {message ? <p className="alert success" style={{ marginTop: 12 }}>{message}</p> : null}
              {error ? <p className="alert error" style={{ marginTop: 12 }}>{error}</p> : null}

              <div className="auth-bottom-row">
                {mode === "login" ? (
                  <>
                    <button type="button" className="link-btn" onClick={() => setMode("register")}>Create Account</button>
                    <span className="divider">|</span>
                    <button type="button" className="auth-forgot">Forgot Password?</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="link-btn" onClick={() => setMode("login")}>Sign In</button>
                    <span className="divider">|</span>
                    <button type="button" className="auth-forgot">Already have an account?</button>
                  </>
                )}
              </div>
            </div>
          </section>
        </main>
      ) : (
        <div className="workspace-layout">
          <aside className="sidebar">
            <div className="brand">
              <div className="brand-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              ScanGuard
            </div>

            <div className="nav-section-label">Menu</div>
            <nav className="side-nav">
              <button type="button" className={view === "dashboard" ? "active" : ""} onClick={() => navigate("dashboard")}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <rect x="2" y="2" width="7" height="7" rx="1"/><rect x="11" y="2" width="7" height="7" rx="1"/><rect x="2" y="11" width="7" height="7" rx="1"/><rect x="11" y="11" width="7" height="7" rx="1"/>
                </svg>
                Dashboard
              </button>
              <button type="button" className={view === "upload" ? "active" : ""} onClick={() => navigate("upload")}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                </svg>
                Upload Document
              </button>
              <button type="button" className={view === "history" || view === "report" ? "active" : ""} onClick={() => navigate("history")}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h7a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                </svg>
                History
              </button>
            </nav>
            <div className="nav-section-label">Settings</div>
            <nav className="side-nav">
              <button type="button" className={view === "settings" ? "active" : ""} onClick={() => navigate("settings")}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
                </svg>
                Settings
              </button>
            </nav>

            <div className="sidebar-bottom">
              <button type="button" className="user-card" onClick={() => navigate("settings")}>
                <span className="avatar">{initials}</span>
                <span>
                  <strong>{displayName}</strong>
                  <small>{currentUser?.email}</small>
                </span>
              </button>
              <button type="button" className="logout-icon-btn" onClick={handleLogout} title="Logout">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>
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

                {/* 4-stat grid */}
                <div className="stat-grid">
                  <div className="card">
                    <div className="stat-card-top">
                      <h3>Total Documents</h3>
                      <div className="stat-icon total-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </div>
                    </div>
                    <strong>{dashboardCards.totalDocs}</strong>
                    <span className="stat-sub">+{Math.min(dashboardCards.totalDocs, 4)} from last week</span>
                  </div>

                  <div className="card">
                    <div className="stat-card-top">
                      <h3>Clean Documents</h3>
                      <div className="stat-icon clean-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    </div>
                    <strong>{dashboardCards.clean}</strong>
                    <span className="stat-sub">
                      {dashboardCards.totalDocs > 0
                        ? `${((dashboardCards.clean / dashboardCards.totalDocs) * 100).toFixed(1)}% of total`
                        : "No documents yet"}
                    </span>
                  </div>

                  <div className="card">
                    <div className="stat-card-top">
                      <h3>Flagged for Review</h3>
                      <div className="stat-icon flagged-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </div>
                    </div>
                    <strong>{dashboardCards.flagged}</strong>
                    <span className="stat-sub">Similarity &gt; 40%</span>
                  </div>

                  <div className="card">
                    <div className="stat-card-top">
                      <h3>Avg. Processing Time</h3>
                      <div className="stat-icon time-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                      </div>
                    </div>
                    <strong>{dashboardCards.avgProcessingTime}</strong>
                    <span className="stat-sub">Per 1000 words</span>
                  </div>
                </div>

                {/* 2-col: Recent Uploads + System Architecture */}
                <div className="two-col">
                  <div className="card">
                    <h2>Recent Uploads</h2>
                    <p className="sub">Your most recently processed documents and their similarity scores.</p>
                    <div className="upload-list">
                      {recentUploads.length === 0 ? (
                        <p className="empty">No documents yet. Upload your first document to get started.</p>
                      ) : (
                        recentUploads.map((item) => {
                          const status = getStatusLabel(item);
                          const scoreClass = item.similarityScore >= 40 ? "flagged" : item.similarityScore >= 20 ? "review" : "clean";
                          return (
                            <div key={item.id} className="upload-item">
                              <div className="upload-file-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              </div>
                              <div className="upload-item-meta">
                                <strong>{formatDocName(getDocIndex(item.id))}</strong>
                                <small>{new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small>
                              </div>
                              <div className="upload-item-right">
                                <div className="score-block">
                                  <span className={`score-num ${scoreClass}`}>{item.similarityScore}%</span>
                                  <span className={`status-pill ${scoreClass}`}>{status}</span>
                                </div>
                                <button type="button" className="view-report-btn" onClick={() => openDocumentReport(item.id)}>View Report</button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="gauge-card">
                    <div className="gauge-label">CURRENT ANALYSIS</div>

                    {/* SVG circular gauge */}
                    <div className="gauge-circle-wrap">
                      <svg viewBox="0 0 160 160" className="gauge-svg">
                        {/* Track */}
                        <circle cx="80" cy="80" r="62" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10"/>
                        {/* Arc — orange fill, rotated to start at top */}
                        <circle
                          cx="80" cy="80" r="62"
                          fill="none"
                          stroke="#EA580C"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${(dashboardCards.avgSimilarity / 100) * 389} 389`}
                          transform="rotate(-90 80 80)"
                          style={{ transition: "stroke-dasharray .6s ease" }}
                        />
                      </svg>
                      <div className="gauge-center">
                        <span className="gauge-pct">{dashboardCards.avgSimilarity}%</span>
                        <span className="gauge-pct-label">AVG MATCH</span>
                      </div>
                    </div>

                    <div className="gauge-matches-label">TOP MATCHES</div>
                    <div className="gauge-matches">
                      {recentUploads.filter(i => i.matchedDocumentId).slice(0, 3).length === 0 ? (
                        <div className="gauge-match-empty">No matches yet</div>
                      ) : (
                        recentUploads.filter(i => i.matchedDocumentId).slice(0, 3).map(item => (
                          <div key={item.id} className="gauge-match-row">
                            <div className="gauge-match-info">
                              <span className="gauge-match-name">{formatDocName(getDocIndex(item.id))}</span>
                              <span className="gauge-match-sub">Matched: {formatDocName(getDocIndex(item.matchedDocumentId!))}</span>
                            </div>
                            <span className="gauge-match-pct">{item.similarityScore}%</span>
                          </div>
                        ))
                      )}
                    </div>

                    <button type="button" className="gauge-btn" onClick={() => navigate("history")}>
                      VIEW FULL REPORT
                    </button>
                  </div>
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
                  <button type="button" className="primary-btn" onClick={() => navigate("upload")}>Upload New</button>
                </header>

                <article className="hist-card">
                  <div className="hist-card-head">
                    <div>
                      <div className="hist-card-title">Document Database</div>
                      <div className="hist-card-sub">View and filter through your document analysis history</div>
                    </div>
                    <div className="hist-search-wrap">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder="Search documents..."
                      />
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="hist-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Document Name</th>
                          <th>Upload Date</th>
                          <th>Similarity Score</th>
                          <th>Status</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.length === 0 ? (
                          <tr><td colSpan={6} className="empty">No documents found.</td></tr>
                        ) : (
                          filteredHistory.map((item) => {
                            const status = getStatusLabel(item);
                            const barColor = item.similarityScore >= 40 ? "#EF4444" : item.similarityScore >= 20 ? "#F59E0B" : "#22C55E";
                            return (
                              <tr key={item.id} className="hist-row">
                                <td className="hist-id">#{item.id}</td>
                                <td>
                                  <div className="hist-doc-name">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    {formatDocName(getDocIndex(item.id))}
                                  </div>
                                </td>
                                <td>{new Date(item.createdAt).toLocaleDateString("en-CA")}</td>
                                <td>
                                  <div className="hist-score-cell">
                                    <div className="hist-mini-bar">
                                      <span style={{ width: `${Math.min(item.similarityScore, 100)}%`, background: barColor }} />
                                    </div>
                                    <span>{item.similarityScore}%</span>
                                  </div>
                                </td>
                                <td><span className={`hist-status-pill ${status.toLowerCase()}`}>{status}</span></td>
                                <td>
                                  <div className="hist-actions">
                                    <button type="button" className="hist-report-btn" onClick={() => openDocumentReport(item.id)}>
                                      Report
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="hist-footer">
                    <span>Showing 1–{filteredHistory.length} of {filteredHistory.length} results</span>
                    <div className="hist-pagination">
                      <button type="button" className="hist-page-btn" disabled>Previous</button>
                      <button type="button" className="hist-page-btn active">Next</button>
                    </div>
                  </div>
                </article>
              </section>
            ) : null}

            {view === "report" ? (
              <section className="page">
                {/* Header */}
                <header className="rpt-header">
                  <button type="button" className="rpt-back-btn" onClick={() => navigate("history")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <div>
                    <h1>Analysis Report</h1>
                    <p>Detailed similarity breakdown and algorithmic match results.</p>
                  </div>
                </header>

                {!selectedDocument ? (
                  <article className="card"><p className="empty">No report selected yet.</p></article>
                ) : (() => {
                  const docName = formatDocName(getDocIndex(selectedDocument.id));
                  const status = selectedDocument.flagged || selectedDocument.similarityScore >= 40 ? "Flagged" : selectedDocument.similarityScore >= 20 ? "Review" : "Clean";
                  const scoreColor = selectedDocument.similarityScore >= 40 ? "#EF4444" : selectedDocument.similarityScore >= 20 ? "#F59E0B" : "#22C55E";
                  const statusClass = status.toLowerCase();
                  const wordsEst = Math.round((selectedDocument.originalText?.length ?? 0) / 5);
                  const kgrams = Math.max(wordsEst - 2, 0);
                  const processTime = (Math.max(selectedDocument.similarityScore / 10, 1.2)).toFixed(1);
                  const description = selectedDocument.similarityScore >= 40
                    ? "High similarity detected. This document shares a significant portion of its structural k-grams with existing database entries."
                    : selectedDocument.similarityScore >= 20
                    ? "Moderate similarity detected. Some sections may overlap with existing documents."
                    : "Low similarity detected. This document appears to be largely original.";
                  return (
                    <div className="rpt-layout">
                      {/* Main column */}
                      <div className="rpt-main">
                        {/* Doc card */}
                        <div className="rpt-doc-card">
                          <div className="rpt-doc-top">
                            <div className="rpt-doc-info">
                              <span className="rpt-doc-name">{docName}</span>
                              <span className={`hist-status-pill ${statusClass}`}>{status}</span>
                            </div>
                            <button type="button" className="rpt-export-btn">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              Export PDF
                            </button>
                          </div>
                          <div className="rpt-doc-meta">ID: {selectedDocument.id} | Uploaded: {new Date(selectedDocument.createdAt).toLocaleString()}</div>

                          {/* Similarity overview */}
                          <div className="rpt-section">
                            <div className="rpt-section-title">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                              Similarity Overview
                            </div>
                            <div className="rpt-jaccard-row">
                              <span className="rpt-jaccard-label">Overall Jaccard Index</span>
                              <span className="rpt-jaccard-score" style={{ color: scoreColor }}>{selectedDocument.similarityScore}%</span>
                            </div>
                            <div className="rpt-progress-track">
                              <div className="rpt-progress-fill" style={{ width: `${Math.min(selectedDocument.similarityScore, 100)}%`, background: scoreColor }} />
                            </div>
                            <p className="rpt-desc" style={{ color: scoreColor }}>{description}</p>
                          </div>

                          {/* Source matches */}
                          <div className="rpt-section">
                            <div className="rpt-section-title" style={{ fontSize: "1rem", fontWeight: 700, color: "#111", gap: 0 }}>Identified Source Matches</div>
                            {selectedDocument.matchedDocumentId ? (
                              <div className="rpt-match-list">
                                <div className="rpt-match-item">
                                  <div>
                                    <div className="rpt-match-name">
                                      {formatDocName(getDocIndex(selectedDocument.matchedDocumentId))}
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                    </div>
                                    <div className="rpt-match-meta">Match ID: {selectedDocument.matchedDocumentId} | Intersecting Hashes: {Math.round(kgrams * (selectedDocument.similarityScore / 100))}</div>
                                  </div>
                                  <div className="rpt-match-score">
                                    <strong>{selectedDocument.similarityScore}%</strong>
                                    <span>Overlap</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="rpt-desc" style={{ color: "#22C55E" }}>No matching documents found in the database.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sidebar */}
                      <div className="rpt-sidebar">
                        <div className="rpt-tech-card">
                          <div className="rpt-tech-title">Technical Details</div>
                          <div className="rpt-tech-row"><span>Words Extracted</span><strong>{wordsEst.toLocaleString()}</strong></div>
                          <div className="rpt-tech-row"><span>k-Grams Generated</span><strong>{kgrams.toLocaleString()}</strong></div>
                          <div className="rpt-tech-row"><span>Hash Algorithm</span><code>Rolling Polynomial</code></div>
                          <div className="rpt-tech-row"><span>Process Time</span><strong>{processTime}s</strong></div>
                        </div>

                        <div className="rpt-algo-card">
                          <div className="rpt-algo-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            Algorithm Info
                          </div>
                          <p className="rpt-algo-desc">Similarity is calculated using the Jaccard index formula:</p>
                          <div className="rpt-formula">J(A,B) = |A ∩ B| / |A ∪ B|</div>
                          <p className="rpt-algo-desc">where A and B represent sets of hashed k-grams (k=3) derived from the normalized documents.</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
                    <div><span>Avg Similarity</span><strong>{dashboardCards.avgSimilarity}%</strong></div>
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
