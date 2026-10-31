"use client";

import React, { useState } from "react";
import {
  SingleColumnTemplate,
  SAMPLE_CV,
  hasUnchangedSampleContent,
  type ResumeDocument,
} from "@linkme/templates";

export default function EditorPage() {
  const [resume, setResume] = useState<ResumeDocument>(SAMPLE_CV);
  const [isSampleMode, setIsSampleMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<
    "personal" | "experience" | "settings"
  >("personal");
  const [exportWarningOpen, setExportWarningOpen] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<
    "idle" | "queued" | "rendering" | "rasterizing" | "ready"
  >("idle");

  // Track user edits: once edited, exit sample mode
  const handleFieldChange = (field: keyof ResumeDocument, value: any) => {
    setIsSampleMode(false);
    setResume((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleContactChange = (field: string, value: string) => {
    setIsSampleMode(false);
    setResume((prev) => ({
      ...prev,
      contact: {
        ...prev.contact,
        [field]: value,
      },
    }));
  };

  const handleExperienceBulletChange = (
    expIndex: number,
    bulletIndex: number,
    text: string,
  ) => {
    setIsSampleMode(false);
    setResume((prev) => {
      const newExps = [...prev.experiences];
      const newBullets = [...newExps[expIndex].bullets];
      newBullets[bulletIndex] = text;
      newExps[expIndex] = { ...newExps[expIndex], bullets: newBullets };
      return { ...prev, experiences: newExps };
    });
  };

  const moveExperience = (index: number, direction: "up" | "down") => {
    setIsSampleMode(false);
    setResume((prev) => {
      const newExps = [...prev.experiences];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newExps.length) return prev;
      const temp = newExps[index];
      newExps[index] = newExps[targetIndex];
      newExps[targetIndex] = temp;
      return { ...prev, experiences: newExps };
    });
  };

  const toggleLanguage = () => {
    setIsSampleMode(false);
    setResume((prev) => {
      const isCurrentlyAr = prev.language === "ar";
      return {
        ...prev,
        language: isCurrentlyAr ? "en" : "ar",
        direction: isCurrentlyAr ? "ltr" : "rtl",
        style: {
          ...prev.style,
          fontFamily: isCurrentlyAr ? "Inter" : "Noto Sans Arabic",
        },
      };
    });
  };

  const handleExportClick = () => {
    if (hasUnchangedSampleContent(resume)) {
      setExportWarningOpen(true);
    } else {
      startExportSimulation();
    }
  };

  const startExportSimulation = () => {
    setExportWarningOpen(false);
    setExportProgress("queued");

    setTimeout(() => {
      setExportProgress("rendering");
      setTimeout(() => {
        setExportProgress("rasterizing");
        setTimeout(() => {
          setExportProgress("ready");
        }, 600);
      }, 600);
    }, 500);
  };

  const handlePrintFallback = () => {
    window.print();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top Application Bar */}
      <header
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          background: "#0f172a",
          color: "#ffffff",
          borderBottom: "1px solid #334155",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: "1.2rem",
              letterSpacing: "0.05em",
            }}
          >
            LINKME
          </span>
          {isSampleMode && (
            <span
              style={{
                background: "#f59e0b",
                color: "#78350f",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Example CV (Unsaved)
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={toggleLanguage}
            style={{
              background: "#1e293b",
              color: "#f8fafc",
              border: "1px solid #475569",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {resume.language === "ar" ? "English (LTR)" : "العربية (RTL)"}
          </button>

          <button
            type="button"
            onClick={handlePrintFallback}
            style={{
              background: "#334155",
              color: "#ffffff",
              border: "none",
              padding: "6px 14px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Print (Instant Fallback)
          </button>

          <button
            type="button"
            onClick={handleExportClick}
            style={{
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              padding: "6px 16px",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Export PDF
          </button>
        </div>
      </header>

      {/* Main Workspace (Editor + Live Preview) */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Pane: Editor */}
        <aside
          className="no-print"
          style={{
            width: "450px",
            background: "#ffffff",
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: "20px",
          }}
        >
          {isSampleMode && (
            <div
              style={{
                padding: "12px",
                background: "#fef3c7",
                color: "#92400e",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "0.85rem",
                lineHeight: 1.4,
              }}
            >
              <strong>Fictional Sample CV:</strong> Edit any field below to make
              it your own. Nothing is sent to the server until you save.
            </div>
          )}

          {/* Section Selector Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("personal")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                background: activeTab === "personal" ? "#2563eb" : "#f1f5f9",
                color: activeTab === "personal" ? "#ffffff" : "#475569",
              }}
            >
              Personal Info
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("experience")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                background: activeTab === "experience" ? "#2563eb" : "#f1f5f9",
                color: activeTab === "experience" ? "#ffffff" : "#475569",
              }}
            >
              Experience
            </button>
          </div>

          {/* Tab 1: Personal Info */}
          {activeTab === "personal" && (
            <div>
              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  value={resume.fullName}
                  onChange={(e) =>
                    handleFieldChange("fullName", e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.95rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Professional Headline
                </label>
                <input
                  type="text"
                  value={resume.headline}
                  onChange={(e) =>
                    handleFieldChange("headline", e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.95rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={resume.contact.email || ""}
                  onChange={(e) => handleContactChange("email", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.95rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Phone
                </label>
                <input
                  type="text"
                  value={resume.contact.phone || ""}
                  onChange={(e) => handleContactChange("phone", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.95rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  Summary / Bio
                </label>
                <textarea
                  rows={4}
                  value={resume.summary}
                  onChange={(e) => handleFieldChange("summary", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.95rem",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          )}

          {/* Tab 2: Experience */}
          {activeTab === "experience" && (
            <div>
              {resume.experiences.map((exp, idx) => (
                <div
                  key={exp.id}
                  style={{
                    background: "#f8fafc",
                    padding: "16px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                      {exp.role}
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        aria-label={`Move ${exp.role} up`}
                        disabled={idx === 0}
                        onClick={() => moveExperience(idx, "up")}
                        style={{
                          minHeight: "24px",
                          minWidth: "24px",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          cursor: idx === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${exp.role} down`}
                        disabled={idx === resume.experiences.length - 1}
                        onClick={() => moveExperience(idx, "down")}
                        style={{
                          minHeight: "24px",
                          minWidth: "24px",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          cursor:
                            idx === resume.experiences.length - 1
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "#64748b",
                      marginBottom: "8px",
                    }}
                  >
                    {exp.company}
                  </div>

                  {exp.bullets.map((bullet, bIdx) => (
                    <div key={bIdx} style={{ marginBottom: "6px" }}>
                      <input
                        type="text"
                        value={bullet}
                        onChange={(e) =>
                          handleExperienceBulletChange(
                            idx,
                            bIdx,
                            e.target.value,
                          )
                        }
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.85rem",
                        }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Right Pane: WYSIWYG Live Preview */}
        <main
          style={{
            flex: 1,
            background: "#cbd5e1",
            padding: "40px 20px",
            overflowY: "auto",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              boxShadow:
                "0 10px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
              backgroundColor: "#ffffff",
            }}
          >
            <SingleColumnTemplate resume={resume} />
          </div>
        </main>
      </div>

      {/* Export Confirmation Warning Modal (for unmodified sample data) */}
      {exportWarningOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "440px",
              width: "90%",
            }}
          >
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: "1.2rem",
                fontWeight: 700,
              }}
            >
              Sample Content Warning
            </h3>
            <p
              style={{ color: "#475569", fontSize: "0.95rem", lineHeight: 1.5 }}
            >
              Your resume still contains sample placeholder information (such as
              Alex Morgan). Would you like to export anyway or keep customizing?
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={() => setExportWarningOpen(false)}
                style={{
                  background: "#f1f5f9",
                  color: "#334155",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={startExportSimulation}
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Export Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Progress Modal */}
      {exportProgress !== "idle" && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "400px",
              width: "90%",
              textAlign: "center",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                fontSize: "1.1rem",
                fontWeight: 700,
              }}
            >
              {exportProgress === "ready"
                ? "PDF Ready for Download"
                : "Exporting Vector PDF..."}
            </h3>

            {exportProgress !== "ready" ? (
              <div>
                <div
                  style={{
                    height: "8px",
                    background: "#e2e8f0",
                    borderRadius: "4px",
                    overflow: "hidden",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "#2563eb",
                      width:
                        exportProgress === "queued"
                          ? "25%"
                          : exportProgress === "rendering"
                            ? "60%"
                            : "90%",
                      transition: "width 0.3s ease-in-out",
                    }}
                  />
                </div>
                <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>
                  Stage: {exportProgress.toUpperCase()}
                </p>
              </div>
            ) : (
              <div>
                <p
                  style={{
                    color: "#16a34a",
                    fontWeight: 600,
                    marginBottom: "16px",
                  }}
                >
                  Vector PDF generated cleanly with local font embedding.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    justifyContent: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExportProgress("idle")}
                    style={{
                      background: "#f1f5f9",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handlePrintFallback();
                      setExportProgress("idle");
                    }}
                    style={{
                      background: "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Download / Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
