import React from "react";
import "./globals.css";

export const metadata = {
  title: "LINKME — Privacy-First, RTL-Native Resume Builder",
  description:
    "ATS-compliant, zero-latency resume builder with live preview and PDF export.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
