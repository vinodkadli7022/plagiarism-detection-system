import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { api } from "./api";
import type { AdminStats, DocumentDetails, HistoryItem, UploadResult } from "./types";

type AppView = "dashboard" | "upload" | "history" | "settings" | "report";
type FilterMode = "all" | "high" | "clean";

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

const formatAgo = (createdAt: string) => {
  const now = Date.now();
  const then = new Date(createdAt).getTime();
  const diffMinutes = Math.max(Math.floor((now - then) / 60000), 0);

  if (diffMinutes < 60) {
    return `${diffMinutes || 1} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [view, setView] = useState<AppView>("dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentEmail, setCurrentEmail] = useState("");
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
  const [profileFormMessage, setProfileFormMessage] = useState("");
  const [profileFormError, setProfileFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  const totalDocuments = adminStats?.documentsCount ?? history.length;
  const flaggedDocuments = adminStats?.flaggedDocumentsCount ?? history.filter((item) => item.flagged).length;
  const cleanDocuments = Math.max(totalDocuments - flaggedDocuments, 0);
  const cleanPercent = totalDocuments > 0 ? ((cleanDocuments / totalDocuments) * 100).toFixed(1) : "0.0";

  const recentUploads = useMemo(() => history.slice(0, 4), [history]);

  const filteredHistory = useMemo(() => {
    const byFilter =
      historyFilter === "all"
        ? history
        : history.filter((item) => (historyFilter === "high" ? item.flagged : !item.flagged));

    const trimmed = searchText.trim().toLowerCase();
    if (!trimmed) {
      return byFilter;
    }

    return byFilter.filter((item) => {
      const name = `document_${item.id}.txt`;
      return name.includes(trimmed) || new Date(item.createdAt).toLocaleString().toLowerCase().includes(trimmed);
    });
  }, [history, historyFilter, searchText]);

  const userInitials = useMemo(() => {
    const display = profileName.trim() || formatDisplayName(currentEmail);
    const pieces = display.split(" ").filter(Boolean);
    if (!pieces.length) {
      return "U";
    }
    return pieces
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [currentEmail, profileName]);

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
      setSelectedFile(file);
      setMessage("Document analyzed successfully");
      await refreshData(token);
      await handleFetchDocument(result.documentId, false);
      setView("report");
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
    await uploadSelectedFile(file);
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFetchDocument = async (id: number, setSuccessMessage = true) => {
    if (!token) {
      return;
    }

    resetAlerts();
    setLoading(true);

    try {
      const data = await api.getDocumentById(id, token);
      setSelectedDocument(data);
      setView("report");
      if (setSuccessMessage) {
        setMessage(`Loaded report for document_${id}.txt`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch document");
    } finally {
      setLoading(false);
    }
  };

  const downloadReportText = (details: DocumentDetails, filePrefix = "report_document") => {
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
    anchor.download = `${filePrefix}_${details.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSelected = () => {
    if (!selectedDocument) {
      return;
    }
    downloadReportText(selectedDocument, "report_document");
  };

  const handleHistoryDownload = async (item: HistoryItem) => {
    if (!token) {
      return;
    }
    try {
      const details = await api.getDocumentById(item.id, token);
      downloadReportText(details, "history_document");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download report");
    }
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
      setProfileFormMessage("Profile saved successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      setError(msg);
      setProfileFormError(msg);
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

  const handleLogout = () => {
    setToken(null);
    setCurrentUserId(null);
    setCurrentEmail("");
    setProfileName("");
    setProfilePlan("Premium");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setSelectedFile(null);
    setLatestResult(null);
    setAdminStats(null);
    setHistory([]);
    setSelectedDocument(null);
    setHistoryFilter("all");
    setSearchText("");
    setIsDragging(false);
    setView("dashboard");
    setMessage("");
    setError("");
  };

  return (
    <div className="app-shell">
      {!isAuthenticated ? (
        <section className="auth-screen">
          <article className="auth-hero">
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
              <button
                type="button"
                onClick={() => setMode("register")}
                className={mode === "register" ? "active" : ""}
              >
                Register
              </button>
            </div>
          </article>
          {message ? <p className="alert success auth-alert">{message}</p> : null}
          {error ? <p className="alert error auth-alert">{error}</p> : null}
        </section>
      ) : (
        <>
          <aside className="sidebar">
            <div className="brand-block">
              <div className="brand-logo">DG</div>
              <div>
                <h3>DocuGuard</h3>
                <small>{userInitials}</small>
              </div>
            </div>

            <nav className="nav-links">
              <button type="button" className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Dashboard</button>
              <button type="button" className={view === "upload" ? "active" : ""} onClick={() => setView("upload")}>Upload Document</button>
              <button type="button" className={view === "history" ? "active" : ""} onClick={() => setView("history")}>History</button>
              <button type="button" className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>Settings</button>
            </nav>

            <div className="sidebar-user">
              <strong>{profileName || formatDisplayName(currentEmail)}</strong>
              <small>{currentEmail}</small>
              <button type="button" onClick={handleLogout}>Logout</button>
            </div>
          </aside>

          <main className="workspace-main">
            <header className="top-bar">
              <div>
                <strong>{view === "report" ? "Report" : view[0].toUpperCase() + view.slice(1)}</strong>
                <p>Overview of your document processing and similarity analysis.</p>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={handleDownloadSelected}
                disabled={!selectedDocument}
              >
                Download Report
              </button>
            </header>

            {message ? <p className="alert success">{message}</p> : null}
            {error ? <p className="alert error">{error}</p> : null}

            {view === "dashboard" ? (
              <section className="dashboard-grid">
                <article className="metric-card">
                  <span>Total Documents</span>
                  <strong>{totalDocuments}</strong>
                  <small>+4 from last week</small>
                </article>
                <article className="metric-card">
                  <span>Clean Documents</span>
                  <strong>{cleanDocuments}</strong>
                  <small>{cleanPercent}% of total</small>
                </article>
                <article className="metric-card">
                  <span>Flagged for Review</span>
                  <strong>{flaggedDocuments}</strong>
                  <small>Similarity &gt; 40%</small>
                </article>
                <article className="metric-card">
                  <span>Avg. Processing Time</span>
                  <strong>1.2s</strong>
                  <small>Per 1000 words</small>
                </article>

                <article className="panel recent-panel">
                  <div className="panel-head">
                    <h2>Recent Uploads</h2>
                  </div>
                  <div className="recent-list">
                    {recentUploads.length === 0 ? (
                      <p className="empty-state">No uploads yet.</p>
                    ) : (
                      recentUploads.map((item) => (
                        <div key={item.id} className="recent-item">
                          <div>
                            <strong>{`document_${item.id}.txt`}</strong>
                            <small>{formatAgo(item.createdAt)}</small>
                          </div>
                          <div className="recent-actions">
                            <span className={`score-tag ${item.flagged ? "high" : "clean"}`}>
                              {item.similarityScore}% {item.flagged ? "Flagged" : "Clean"}
                            </span>
                            <button type="button" onClick={() => handleFetchDocument(item.id)}>
                              View Report
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>

                <article className="panel architecture-panel">
                  <h2>System Architecture</h2>
                  <p>Current processing pipeline status</p>
                  <ul>
                    <li><span>Text Extraction Engine</span> <strong>Online</strong></li>
                    <li><span>k-Gram Tokenizer</span> <strong>Online</strong></li>
                    <li><span>Hashing Service</span> <strong>Online</strong></li>
                    <li><span>PostgreSQL Indexed DB</span> <strong>14ms latency</strong></li>
                  </ul>
                  <button type="button" className="btn-primary" onClick={() => setView("upload")}>
                    Start New Analysis
                  </button>
                </article>
              </section>
            ) : null}

            {view === "upload" ? (
              <section className="single-panel">
                <article className="panel">
                  <h2>Upload Document</h2>
                  <div
                    className={`drop-zone ${isDragging ? "dragging" : ""}`}
                    onClick={triggerFilePicker}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <p>Drag & Drop your document here, or click to browse files</p>
                    <small>Supported formats: .txt, .md (max 2MB)</small>
                  </div>
                  {selectedFile ? <p className="selected-file">Selected: {selectedFile.name}</p> : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    className="hidden-file-input"
                    onChange={handleFileSelect}
                  />
                  {latestResult ? (
                    <div className="upload-result">
                      <strong>Latest Result</strong>
                      <p>Document #{latestResult.documentId}</p>
                      <p>Similarity: {latestResult.similarityScore}%</p>
                      <p>Status: {latestResult.flagged ? "Flagged" : "Clean"}</p>
                    </div>
                  ) : null}
                </article>
              </section>
            ) : null}

            {view === "history" ? (
              <section className="single-panel">
                <article className="panel">
                  <div className="history-toolbar">
                    <input
                      className="history-search"
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      placeholder="Search documents"
                    />
                    <div className="filter-group">
                      <button type="button" className={historyFilter === "all" ? "active" : ""} onClick={() => setHistoryFilter("all")}>All</button>
                      <button type="button" className={historyFilter === "high" ? "active" : ""} onClick={() => setHistoryFilter("high")}>High Risk</button>
                      <button type="button" className={historyFilter === "clean" ? "active" : ""} onClick={() => setHistoryFilter("clean")}>Clean</button>
                    </div>
                  </div>

                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Date Uploaded</th>
                        <th>Similarity</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="empty-table">No results found</td>
                        </tr>
                      ) : (
                        filteredHistory.map((item) => (
                          <tr key={item.id}>
                            <td>{`document_${item.id}.txt`}</td>
                            <td>{new Date(item.createdAt).toLocaleString()}</td>
                            <td>
                              <span className={`score-tag ${item.flagged ? "high" : "clean"}`}>
                                {item.similarityScore}%
                              </span>
                            </td>
                            <td className="action-buttons">
                              <button type="button" onClick={() => handleFetchDocument(item.id)}>View Report</button>
                              <button type="button" onClick={() => handleHistoryDownload(item)}>Download</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </article>
              </section>
            ) : null}

            {view === "settings" ? (
              <section className="single-panel">
                <article className="panel settings-grid">
                  <div>
                    <h2>Settings</h2>
                    <p>Manage profile and security preferences.</p>
                    <div className="settings-meta">
                      <div><span>User ID</span><strong>{currentUserId ?? "N/A"}</strong></div>
                      <div><span>Plan</span><strong>{profilePlan}</strong></div>
                      <div><span>Total Users</span><strong>{adminStats?.usersCount ?? "N/A"}</strong></div>
                      <div><span>Fingerprints</span><strong>{adminStats?.fingerprintsCount ?? "N/A"}</strong></div>
                    </div>
                  </div>

                  <form className="settings-form" onSubmit={handleProfileSave}>
                    <h3>Edit Profile</h3>
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
                    <button type="submit" className="btn-primary" disabled={loading}>Save Profile</button>
                    {profileFormMessage ? <p className="ok-text">{profileFormMessage}</p> : null}
                    {profileFormError ? <p className="error-text">{profileFormError}</p> : null}
                  </form>

                  <form className="settings-form" onSubmit={handlePasswordSave}>
                    <h3>Security</h3>
                    <label>
                      Current Password
                      <input
                        type="password"
                        value={currentPasswordInput}
                        onChange={(event) => setCurrentPasswordInput(event.target.value)}
                      />
                    </label>
                    <label>
                      New Password
                      <input
                        type="password"
                        value={newPasswordInput}
                        onChange={(event) => setNewPasswordInput(event.target.value)}
                      />
                    </label>
                    <label>
                      Confirm New Password
                      <input
                        type="password"
                        value={confirmPasswordInput}
                        onChange={(event) => setConfirmPasswordInput(event.target.value)}
                      />
                    </label>
                    <button type="submit" className="btn-primary" disabled={loading}>Update Password</button>
                  </form>
                </article>
              </section>
            ) : null}

            {view === "report" ? (
              <section className="single-panel">
                <article className="panel report-panel">
                  <h2>Document Report</h2>
                  {!selectedDocument ? (
                    <p className="empty-state">Select a document from history to view report.</p>
                  ) : (
                    <>
                      <div className="report-summary">
                        <div><span>Document</span><strong>{`document_${selectedDocument.id}.txt`}</strong></div>
                        <div><span>Similarity</span><strong>{selectedDocument.similarityScore}%</strong></div>
                        <div><span>Status</span><strong>{selectedDocument.flagged ? "Flagged" : "Clean"}</strong></div>
                        <div><span>Matched</span><strong>{selectedDocument.matchedDocumentId ? `#${selectedDocument.matchedDocumentId}` : "N/A"}</strong></div>
                      </div>
                      <div className="report-text">{selectedDocument.originalText}</div>
                    </>
                  )}
                </article>
              </section>
            ) : null}
          </main>
        </>
      )}
    </div>
  );
}

export default App;
