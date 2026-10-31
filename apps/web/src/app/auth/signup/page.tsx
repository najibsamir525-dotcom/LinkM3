"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ageConfirmed) {
      setErrorMessage("You must confirm you are at least 18 years of age.");
      return;
    }
    if (!termsAccepted) {
      setErrorMessage(
        "You must accept the Terms of Service and Privacy Policy.",
      );
      return;
    }
    if (password.length < 12) {
      setErrorMessage("Password must be at least 12 characters long.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("http://localhost:4000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          ageConfirmed: true,
          termsAccepted: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Sign-up failed. Please try again.");
      }

      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred.");
    }
  };

  return (
    <main style={{ maxWidth: "480px", margin: "60px auto", padding: "0 20px" }}>
      <div
        style={{
          background: "#ffffff",
          padding: "32px",
          borderRadius: "12px",
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        }}
      >
        <h1
          style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px" }}
        >
          Create your Account
        </h1>
        <p style={{ color: "#64748b", marginBottom: "24px" }}>
          Privacy-first resume management. No data sold.
        </p>

        {status === "success" ? (
          <div
            role="status"
            style={{
              padding: "16px",
              background: "#ecfdf5",
              color: "#065f46",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <strong>Registration successful!</strong>
            <p style={{ margin: "8px 0 0 0" }}>
              Please check your email to verify your account before logging in.
            </p>
            <div style={{ marginTop: "16px" }}>
              <Link
                href="/editor"
                style={{
                  color: "#2563eb",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                Continue editing sample CV
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {errorMessage && (
              <div
                role="alert"
                style={{
                  padding: "12px",
                  background: "#fef2f2",
                  color: "#991b1b",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "0.95rem",
                }}
              >
                {errorMessage}
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="name"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Password (12+ characters)
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "1rem",
                }}
              />
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Must be at least 12 characters per NIST SP 800-63B.
              </span>
            </div>

            {/* 18+ Age Gate Checkbox */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                marginBottom: "16px",
              }}
            >
              <input
                id="ageConfirmed"
                type="checkbox"
                required
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                style={{ marginTop: "4px", width: "18px", height: "18px" }}
              />
              <label
                htmlFor="ageConfirmed"
                style={{ fontSize: "0.9rem", color: "#334155" }}
              >
                I confirm that I am at least <strong>18 years of age</strong>.
                (No date of birth is collected).
              </label>
            </div>

            {/* Terms & Privacy Acceptance */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                marginBottom: "24px",
              }}
            >
              <input
                id="termsAccepted"
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: "4px", width: "18px", height: "18px" }}
              />
              <label
                htmlFor="termsAccepted"
                style={{ fontSize: "0.9rem", color: "#334155" }}
              >
                I accept the{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#2563eb" }}
                >
                  Terms of Service
                </a>{" "}
                and acknowledge the{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#2563eb" }}
                >
                  Privacy Policy
                </a>
                .
              </label>
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                width: "100%",
                background: "#2563eb",
                color: "#ffffff",
                padding: "12px",
                borderRadius: "8px",
                fontWeight: 600,
                border: "none",
                cursor: status === "loading" ? "not-allowed" : "pointer",
                fontSize: "1rem",
              }}
            >
              {status === "loading" ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
