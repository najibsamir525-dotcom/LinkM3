import Link from "next/link";
import React from "react";

export default function HomePage() {
  return (
    <main style={{ maxWidth: "800px", margin: "60px auto", padding: "0 20px" }}>
      <header style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, color: "#0f172a" }}>
          LINKME
        </h1>
        <p style={{ fontSize: "1.2rem", color: "#475569" }}>
          Production-Grade, Privacy-First &amp; RTL-Native Resume Builder
        </p>
      </header>

      <section
        style={{
          background: "#ffffff",
          padding: "32px",
          borderRadius: "12px",
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", marginBottom: "16px" }}>
          Build Your ATS-Safe Resume in Minutes
        </h2>
        <p style={{ color: "#64748b", marginBottom: "24px" }}>
          Zero tracking, zero lock-in. Instant live preview that matches the
          exported PDF.
        </p>

        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          <Link
            href="/editor"
            style={{
              display: "inline-block",
              background: "#2563eb",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "8px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Start with Sample CV (No Sign-up Required)
          </Link>

          <Link
            href="/auth/signup"
            style={{
              display: "inline-block",
              background: "#f1f5f9",
              color: "#334155",
              padding: "12px 24px",
              borderRadius: "8px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Create Account
          </Link>
        </div>
      </section>
    </main>
  );
}
