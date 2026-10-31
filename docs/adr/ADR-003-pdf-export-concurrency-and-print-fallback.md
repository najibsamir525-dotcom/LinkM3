# ADR-003: PDF Rendering Engine, Sandboxing & Client Fallback

**Date:** 2026-10-29  
**Status:** Accepted

## Context

A core product requirement is high-fidelity PDF export with selectable vector text, Arabic font support (Amiri, Noto Sans Arabic), exact visual parity with the on-screen preview, and zero watermark on the free tier. At the same time, we face strict zero-cost constraints on a single host VM and severe security risks from untrusted HTML/CSS execution (SSRF, resource exhaustion, fork bombs).

## Decision

1. **Engine:** Use Playwright with Headless Chromium executing inside a sandboxed BullMQ worker container.
2. **Worker Concurrency Limit:** Set worker concurrency strictly to **1** (`concurrency: 1`) with Docker memory limit capped at 768 MiB.
3. **SSRF & Network Sandboxing:**
   - Container executes under non-root user `uid: 10001` with `cap_drop: [ALL]`.
   - All network calls are intercepted in Playwright: only data URIs and local font assets (`file:///app/fonts/*`) are allowed. Any attempt to reach external HTTP/HTTPS endpoints or loopback/metadata IPs (`169.254.169.254`, `localhost`) is immediately aborted.
4. **Zero-Load Client Fallback:** Implement a direct **Browser Print-to-PDF (`window.print()`)** option in the UI, applying the exact same print media query stylesheet.

## Rationale

- Renders the exact DOM/CSS seen by the user in the Next.js preview without layout discrepancies.
- Capping concurrency to 1 prevents Chromium from overloading a free-tier VM (e.g. 1-4 vCPU instances).
- The client-side print fallback allows users to export immediately without waiting in the server queue, consuming 0 server CPU and 0 server RAM.

## Consequences

- Long PDF generation jobs queue up sequentially on the server; the UI displays a live BullMQ queue progress bar.
- The client-side print option provides instant resilience if the server worker is under load.
