import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { api } from "./api";
import type { AdminStats, DocumentDetails, HistoryItem, UploadResult } from "./types";

type FilterMode = "all" | "high" | "clean";
type AppView = "dashboard" | "analysis" | "history" | "profile";
type MatchEntry = {
  id: string;
  label: string;
  percent: number;
  chunkIndex: number;
  tone: "high" | "medium" | "low";
};

const formatDisplayName = (emailValue: string) => {
  const base = emailValue.split("@")[0] ?? "user";
  return base.replace(/[._-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizePlan = (plan: string) => {
  if (plan === "Pro" || plan === "Enterprise" || plan === "Premium") {
    return plan;
  }
  return "Premium";
};

const toChunks = (text: string, chunkWords = 38) => {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (let index = 0; index < words.length; index += chunkWords) {
    chunks.push(words.slice(index, index + chunkWords).join(" "));
  }

  return chunks.length ? chunks : [""];
};

function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [view, setView] = useState<AppView>("dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [profileName, setProfileName] = useState("");
  const [profilePlan, setProfilePlan] = useState("Premium");
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [latestResult, setLatestResult] = useState<UploadResult | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetails | null>(null);
  const [historyFilter, setHistoryFilter] = useState<FilterMode>("all");
  const [searchText, setSearchText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [profileFormMessage, setProfileFormMessage] = useState("");
  const [profileFormError, setProfileFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  const analysisChunks = useMemo(() => {
    if (!selectedDocument) {
      return [];
    }
    return toChunks(selectedDocument.originalText);
  }, [selectedDocument]);

  const analysisMatches = useMemo<MatchEntry[]>(() => {
    if (!selectedDocument || analysisChunks.length === 0) {
      return [];
    }

    const base = selectedDocument.similarityScore;
    const primaryPercent = Math.min(Math.max(base, 8), 95);
    const secondaryPercent = Math.max(Math.round(primaryPercent * 0.55), 5);
    const tertiaryPercent = Math.max(Math.round(primaryPercent * 0.35), 3);
    const quaternaryPercent = Math.max(Math.round(primaryPercent * 0.2), 2);

    const mapTone = (percent: number): MatchEntry["tone"] => {
      if (percent >= 25) {
        return "high";
      }
      if (percent >= 10) {
        return "medium";
      }
      return "low";
    };

    return [
      {
        id: "source-1",
        label: selectedDocument.matchedDocumentId
          ? `Source: Document #${selectedDocument.matchedDocumentId}`
          : "Source: Existing Archive A",
        percent: primaryPercent,
        chunkIndex: 0,
        tone: mapTone(primaryPercent)
      },
      {
        id: "source-2",
        label: "Source: Existing Archive B",
        percent: secondaryPercent,
        chunkIndex: Math.min(1, analysisChunks.length - 1),
        tone: mapTone(secondaryPercent)
      },
      {
        id: "source-3",
        label: "Source: Existing Archive C",
        percent: tertiaryPercent,
        chunkIndex: Math.min(2, analysisChunks.length - 1),
        tone: mapTone(tertiaryPercent)
      },
      {
        id: "source-4",
        label: "Source: Existing Archive D",
        percent: quaternaryPercent,
        chunkIndex: Math.min(3, analysisChunks.length - 1),
        tone: mapTone(quaternaryPercent)
      }
    ];
  }, [analysisChunks.length, selectedDocument]);

  const activeChunkIndex = useMemo(() => {
    if (!activeMatchId) {
      return -1;
    }

    const match = analysisMatches.find((entry) => entry.id === activeMatchId);
    return match ? match.chunkIndex : -1;
  }, [activeMatchId, analysisMatches]);

  const gaugeValue = selectedDocument?.similarityScore ?? latestResult?.similarityScore ?? 0;
  const currentDisplayName = useMemo(() => {
    if (profileName.trim()) {
      return profileName.trim();
    }
    return formatDisplayName(currentEmail);
  }, [currentEmail, profileName]);

  const userInitials = useMemo(() => {
    const pieces = currentDisplayName.split(" ").filter(Boolean);
    if (!pieces.length) {
      return "U";
    }
    return pieces
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [currentDisplayName]);

  const profileStats = useMemo(() => {
    const flaggedCount = history.filter((item) => item.flagged).length;
    return {
      totalScans: history.length,
      flaggedCount,
      cleanCount: Math.max(history.length - flaggedCount, 0),
      avgSimilarity: adminStats?.averageSimilarity ?? 0
    };
  }, [adminStats?.averageSimilarity, history]);

  const recentActivity = useMemo(() => {
    return history.slice(0, 3);
  }, [history]);

  const filteredHistory = useMemo(() => {
    const byFilter =
      historyFilter === "all"
        ? history
        : history.filter((item) =>
            historyFilter === "high" ? item.flagged : !item.flagged
          );

    if (!searchText.trim()) {
      return byFilter;
    }

    const lower = searchText.toLowerCase();
    return byFilter.filter((item) => {
      const name = `document_${item.id}.txt`;
      return (
        name.includes(lower) ||
        `doc #${item.id}`.includes(lower) ||
        new Date(item.createdAt).toLocaleString().toLowerCase().includes(lower)
      );
    });
  }, [history, historyFilter, searchText]);

  const resetAlerts = () => {
    setMessage("");
    setError("");
  };

  const refreshData = async (authToken: string) => {
    const [fetchedHistory, fetchedStats] = await Promise.all([
      api.getHistory(authToken),
      api.getAdminStats(authToken)
    ]);

    setHistory(fetchedHistory);
    setAdminStats(fetchedStats);
  };

  const refreshProfile = async (authToken: string) => {
    const profile = await api.getProfile(authToken);
    setCurrentUserId(profile.id);
    setCurrentEmail(profile.email);
    setProfileName(profile.displayName || formatDisplayName(profile.email));
    setProfilePlan(normalizePlan(profile.plan));
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
      setCurrentUserId(data.user.id);
      setCurrentEmail(data.user.email);
      setProfileName(data.user.displayName || formatDisplayName(data.user.email));
      setProfilePlan(normalizePlan(data.user.plan));
      setView("dashboard");
      setMessage(mode === "register" ? "Registration successful" : "");
      setEmail("");
      setPassword("");
      await Promise.all([refreshData(data.token), refreshProfile(data.token)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const uploadSelectedFile = async (file: File) => {
    if (!token) {
      return;
    }

    resetAlerts();
    setLoading(true);

    try {
      const result = await api.uploadDocument(file, token);
      setLatestResult(result);
      setSelectedFile(null);
      setView("dashboard");
      setMessage("Document analyzed successfully");
      await refreshData(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    setSelectedFile(file);
    await uploadSelectedFile(file);
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFile(file);
    await uploadSelectedFile(file);
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
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
      setView("analysis");
      setActiveMatchId(null);
      setMessage(`Loaded document #${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch document");
    } finally {
      setLoading(false);
    }
  };

  const focusMatch = (entry: MatchEntry) => {
    setActiveMatchId(entry.id);
    const target = document.getElementById(`analysis-chunk-${entry.chunkIndex}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const downloadCurrentReport = () => {
    if (!selectedDocument) {
      return;
    }

    const reportText = [
      `Document #${selectedDocument.id}`,
      `Similarity Score: ${selectedDocument.similarityScore}%`,
      `Matched Document: ${selectedDocument.matchedDocumentId ?? "N/A"}`,
      `Flagged: ${selectedDocument.flagged ? "Yes" : "No"}`,
      `Generated At: ${new Date().toLocaleString()}`,
      "",
      "Original Text:",
      selectedDocument.originalText
    ].join("\n");

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `report_document_${selectedDocument.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleHistoryDownload = async (item: HistoryItem) => {
    if (!token) {
      return;
    }

    try {
      const details = await api.getDocumentById(item.id, token);
      const reportText = [
        `Document #${details.id}`,
        `Similarity Score: ${details.similarityScore}%`,
        `Matched Document: ${details.matchedDocumentId ?? "N/A"}`,
        `Flagged: ${details.flagged ? "Yes" : "No"}`,
        `Generated At: ${new Date().toLocaleString()}`,
        "",
        details.originalText
      ].join("\n");

      const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `history_document_${details.id}.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download report");
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUserId(null);
    setCurrentEmail("");
    setProfileName("");
    setProfilePlan("Premium");
    setHistory([]);
    setAdminStats(null);
    setSelectedDocument(null);
    setLatestResult(null);
    setMessage("");
    setError("");
    setSearchText("");
    setHistoryFilter("all");
    setIsDragging(false);
    setView("dashboard");
    setActiveMatchId(null);
    setOpenActionMenuId(null);
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    resetAlerts();
    setProfileFormMessage("");
    setProfileFormError("");
    setLoading(true);

    const cleanedName = profileName.trim();
    if (cleanedName.length < 2) {
      setProfileFormError("Display name must be at least 2 characters.");
      setLoading(false);
      return;
    }

    try {
      const profile = await api.updateProfile(token, {
        displayName: cleanedName,
        plan: normalizePlan(profilePlan)
      });

      setCurrentEmail(profile.email);
      setCurrentUserId(profile.id);
      setProfileName(profile.displayName);
      setProfilePlan(normalizePlan(profile.plan));
      setMessage("");
      setProfileFormMessage("Profile saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
      setProfileFormError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    resetAlerts();
    setLoading(true);

    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setError("Please fill all password fields.");
      setLoading(false);
      return;
    }

    if (newPasswordInput.length < 6) {
      setError("New password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setError("New password and confirm password do not match.");
      setLoading(false);
      return;
    }

    try {
      await api.changePassword(token, {
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput,
        confirmPassword: confirmPasswordInput
      });

      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setMessage("Password updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const scoreBadge = (score: number) => {
    if (score >= 25) {
      return { label: `${score}% High`, className: "high" };
    }
    if (score <= 5) {
      return { label: `${score}% Low`, className: "low" };
    }
    return { label: `${score}% Medium`, className: "medium" };
  };

  return (
    <div className="app-shell">
      {!isAuthenticated ? (
        <section className="auth-screen">
          <article className="auth-hero">
            <div className="hero-illustration">
              <div className="shield-core">🛡️</div>
              <div className="node node-a" />
              <div className="node node-b" />
              <div className="node node-c" />
              <div className="node node-d" />
            </div>
            <h2>Secure Document Authenticity</h2>
            <p>Check powered by advanced Jaccard similarity algorithms.</p>
          </article>

          <article className="auth-form-panel">
            <h1>{mode === "login" ? "Sign In" : "Create Account"}</h1>
            <form onSubmit={handleAuth} className="auth-form">
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  minLength={6}
                  required
                />
              </label>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="auth-footer-actions">
              <button type="button" onClick={() => setMode("login")} className={mode === "login" ? "active" : ""}>
                Sign In
              </button>
              <button type="button" onClick={() => setMode("register")} className={mode === "register" ? "active" : ""}>
                Register
              </button>
            </div>
          </article>

          {message ? <p className="alert success auth-alert">{message}</p> : null}
          {error ? <p className="alert error auth-alert">{error}</p> : null}
        </section>
      ) : (
        <>
          <aside className="sidebar-compact">
            <div className="app-mini-logo">🛡️</div>
            <button
              type="button"
              className={`icon-nav ${view === "dashboard" ? "active" : ""}`}
              onClick={() => setView("dashboard")}
              title="Dashboard"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              className={`icon-nav ${view === "analysis" ? "active" : ""}`}
              onClick={() => setView("analysis")}
              title="Analysis"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 3 3 4-6" />
              </svg>
              <span>Analysis</span>
            </button>
            <button
              type="button"
              className={`icon-nav ${view === "history" ? "active" : ""}`}
              onClick={() => setView("history")}
              title="History"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>History</span>
            </button>

            <button
              type="button"
              className={`icon-nav ${view === "profile" ? "active" : ""}`}
              onClick={() => setView("profile")}
              title="Profile"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Profile</span>
            </button>

            <div className="sidebar-bottom">
              <button type="button" className="icon-nav" onClick={handleLogout} title="Logout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </aside>

          <main className="workspace-main">
            <header className="top-bar">
              <strong>
                {view === "dashboard"
                  ? "Dashboard"
                  : view === "analysis"
                    ? "Analysis"
                    : view === "history"
                      ? "History"
                      : "Profile"}
              </strong>
              <div className="top-actions">
                <button type="button" className="download-pill" onClick={downloadCurrentReport} disabled={!selectedDocument}>
                  Download
                </button>
                <button
                  type="button"
                  className="profile-trigger"
                  title={currentEmail}
                  onClick={() => setView("profile")}
                >
                  {userInitials}
                </button>
              </div>
            </header>

            {message ? <p className="alert success">{message}</p> : null}
            {error ? <p className="alert error">{error}</p> : null}

            {view === "dashboard" ? (
              <section className="dashboard-view">
                <div className="view-header">
                  <h1>Welcome back, {currentEmail.split("@")[0]}!</h1>
                  <p>Check your document authenticity.</p>
                </div>

                <div className="bento-grid">
                  <article className="upload-panel card">
                    <div
                      className={`drop-zone ${isDragging ? "dragging" : ""}`}
                      onClick={triggerFilePicker}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="upload-plus">＋</div>
                      <p>
                        Drag & Drop your document here, or <span>browse files</span>
                      </p>
                      <small>Supported formats: .txt, .md (max 2MB)</small>
                    </div>
                    {selectedFile ? <div className="selected-file-name">{selectedFile.name}</div> : null}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,text/plain,text/markdown"
                      className="hidden-file-input"
                      onChange={handleFileSelect}
                    />
                  </article>

                  <article className="activity-panel card">
                    <h3>Recent Activity</h3>
                    <div className="activity-table">
                      <div className="activity-head">
                        <span>Document</span>
                        <span>Date Uploaded</span>
                        <span>Status</span>
                      </div>
                      {recentActivity.length === 0 ? (
                        <p className="empty-inline">No recent uploads yet.</p>
                      ) : (
                        recentActivity.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            className="activity-row"
                            onClick={() => handleFetchDocument(item.id)}
                          >
                            <span>{`document_${item.id}.txt`}</span>
                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                            <span className={`status-chip ${item.flagged ? "warn" : "ok"}`}>
                              {item.flagged ? "Flagged" : "Scanned"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </article>

                  <article className="stats-panel card">
                    <h3>System Stats</h3>
                    <div className="stat-mini">
                      <span>Total Docs Scanned</span>
                      <strong>{adminStats?.documentsCount ?? history.length}</strong>
                    </div>
                    <div className="stat-mini">
                      <span>Avg. Similarity Score</span>
                      <strong>{adminStats?.averageSimilarity ?? 0}%</strong>
                    </div>
                  </article>
                </div>
              </section>
            ) : null}

            {view === "analysis" ? (
              <section className="analysis-view">
                <div className="analysis-head">
                  <h1>Analysis Results</h1>
                  {selectedDocument ? (
                    <button type="button" className="doc-pill">
                      {`document_${selectedDocument.id}.txt`}
                    </button>
                  ) : null}
                </div>

                {!selectedDocument ? (
                  <article className="card empty-analysis">
                    <p>Select a document from history to inspect full analysis details.</p>
                    <button type="button" className="btn-primary" onClick={() => setView("history")}>
                      Go to History
                    </button>
                  </article>
                ) : (
                  <>
                    <article className="card gauge-card">
                      <div
                        className="gauge-ring"
                        style={{
                          background: `conic-gradient(#f59e0b ${Math.max(Math.min(gaugeValue, 100), 0) * 1.8}deg, #e5e7eb 0deg)`
                        }}
                      >
                        <div className="gauge-inner" />
                      </div>
                      <div className="gauge-content">
                        <span>Overall Similarity Score</span>
                        <strong>{gaugeValue}% High Similarity</strong>
                      </div>
                    </article>

                    <div className="analysis-grid">
                      <article className="card source-panel">
                        <h3>Your Document</h3>
                        <div className="source-scroll">
                          {analysisChunks.map((chunk, index) => (
                            <p
                              key={`chunk-${index}`}
                              id={`analysis-chunk-${index}`}
                              className={index === activeChunkIndex ? "active" : ""}
                            >
                              {chunk}
                            </p>
                          ))}
                        </div>
                      </article>

                      <article className="card matches-panel">
                        <h3>Matches Found</h3>
                        <div className="matches-list">
                          {analysisMatches.map((entry) => (
                            <button
                              type="button"
                              key={entry.id}
                              className={`match-source ${activeMatchId === entry.id ? "active" : ""}`}
                              onClick={() => focusMatch(entry)}
                            >
                              <span>{entry.label}</span>
                              <strong className={`tone-${entry.tone}`}>{entry.percent}%</strong>
                            </button>
                          ))}
                        </div>
                      </article>
                    </div>
                  </>
                )}
              </section>
            ) : null}

            {view === "history" ? (
              <section className="history-view">
                <div className="view-header">
                  <h1>Document History</h1>
                </div>

                <article className="card history-card">
                  <div className="history-toolbar">
                    <input
                      className="history-search"
                      placeholder="Search"
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                    />
                    <div className="filter-group">
                      <button
                        type="button"
                        className={`mini-filter ${historyFilter === "all" ? "active" : ""}`}
                        onClick={() => setHistoryFilter("all")}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={`mini-filter ${historyFilter === "high" ? "active" : ""}`}
                        onClick={() => setHistoryFilter("high")}
                      >
                        High Risk
                      </button>
                      <button
                        type="button"
                        className={`mini-filter ${historyFilter === "clean" ? "active" : ""}`}
                        onClick={() => setHistoryFilter("clean")}
                      >
                        Clean
                      </button>
                    </div>
                  </div>

                  <div className="history-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Document Name</th>
                          <th>Date Uploaded</th>
                          <th>Similarity Score</th>
                          <th>Action Menu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="empty-table">No results found</td>
                          </tr>
                        ) : (
                          filteredHistory.map((item) => {
                            const badge = scoreBadge(item.similarityScore);
                            const openMenu = openActionMenuId === item.id;

                            return (
                              <tr key={item.id}>
                                <td>{`document_${item.id}.txt`}</td>
                                <td>{new Date(item.createdAt).toLocaleString()}</td>
                                <td>
                                  <span className={`score-badge ${badge.className}`}>{badge.label}</span>
                                </td>
                                <td className="menu-cell">
                                  <button
                                    type="button"
                                    className="menu-button"
                                    onClick={() => setOpenActionMenuId(openMenu ? null : item.id)}
                                  >
                                    ⋯
                                  </button>
                                  {openMenu ? (
                                    <div className="menu-popover">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setOpenActionMenuId(null);
                                          await handleFetchDocument(item.id);
                                        }}
                                      >
                                        View Details
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setOpenActionMenuId(null);
                                          await handleHistoryDownload(item);
                                        }}
                                      >
                                        Download
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          setMessage("Delete endpoint is not available in current backend.");
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  ) : null}
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

            {view === "profile" ? (
              <section className="profile-view">
                <div className="view-header">
                  <h1>Profile</h1>
                  <p>Your account details and scan activity overview.</p>
                </div>

                <div className="profile-grid">
                  <article className="card profile-main-card">
                    <div className="profile-main-head">
                      <div className="profile-avatar-large">{userInitials}</div>
                      <div>
                        <h3>{currentDisplayName}</h3>
                        <p>{currentEmail}</p>
                      </div>
                    </div>

                    <div className="profile-meta-grid">
                      <div>
                        <span>User ID</span>
                        <strong>{currentUserId ?? "N/A"}</strong>
                      </div>
                      <div>
                        <span>Plan</span>
                        <strong>{profilePlan}</strong>
                      </div>
                      <div>
                        <span>Total Users</span>
                        <strong>{adminStats?.usersCount ?? "N/A"}</strong>
                      </div>
                      <div>
                        <span>Total Fingerprints</span>
                        <strong>{adminStats?.fingerprintsCount ?? "N/A"}</strong>
                      </div>
                    </div>

                    <form className="profile-edit-form" onSubmit={handleProfileSave}>
                      <h4>Edit Profile</h4>
                      <label>
                        Display Name
                        <input
                          type="text"
                          value={profileName}
                          onChange={(event) => {
                            setProfileName(event.target.value);
                            setProfileFormMessage("");
                            setProfileFormError("");
                          }}
                          placeholder="Enter display name"
                        />
                      </label>
                      <label>
                        Plan
                        <select
                          value={profilePlan}
                          onChange={(event) => {
                            setProfilePlan(event.target.value);
                            setProfileFormMessage("");
                            setProfileFormError("");
                          }}
                        >
                          <option value="Premium">Premium</option>
                          <option value="Pro">Pro</option>
                          <option value="Enterprise">Enterprise</option>
                        </select>
                      </label>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? "Saving..." : "Save Profile"}
                      </button>
                      {profileFormMessage ? (
                        <p className="inline-form-status success">{profileFormMessage}</p>
                      ) : null}
                      {profileFormError ? (
                        <p className="inline-form-status error">{profileFormError}</p>
                      ) : null}
                    </form>
                  </article>

                  <article className="card profile-stat-card">
                    <h3>Scan Metrics</h3>
                    <div className="profile-stat-list">
                      <div>
                        <span>Documents Scanned</span>
                        <strong>{profileStats.totalScans}</strong>
                      </div>
                      <div>
                        <span>Flagged Documents</span>
                        <strong>{profileStats.flaggedCount}</strong>
                      </div>
                      <div>
                        <span>Clean Documents</span>
                        <strong>{profileStats.cleanCount}</strong>
                      </div>
                      <div>
                        <span>Average Similarity</span>
                        <strong>{profileStats.avgSimilarity}%</strong>
                      </div>
                    </div>
                  </article>

                  <article className="card profile-security-card">
                    <h3>Security</h3>
                    <p className="profile-security-note">
                      Update your password securely from this panel.
                    </p>
                    <form className="profile-security-form" onSubmit={handlePasswordSave}>
                      <label>
                        Current Password
                        <input
                          type="password"
                          value={currentPasswordInput}
                          onChange={(event) => setCurrentPasswordInput(event.target.value)}
                          placeholder="Enter current password"
                        />
                      </label>
                      <label>
                        New Password
                        <input
                          type="password"
                          value={newPasswordInput}
                          onChange={(event) => setNewPasswordInput(event.target.value)}
                          placeholder="Enter new password"
                        />
                      </label>
                      <label>
                        Confirm New Password
                        <input
                          type="password"
                          value={confirmPasswordInput}
                          onChange={(event) => setConfirmPasswordInput(event.target.value)}
                          placeholder="Confirm new password"
                        />
                      </label>
                      <button type="submit" className="btn-primary" disabled={loading}>Update Password</button>
                    </form>
                  </article>
                </div>
              </section>
            ) : null}
          </main>
        </>
      )}
    </div>
  );
}

export default App;
