# ADR-002: Authentication Framework Selection: Better Auth

**Date:** 2026-10-29  
**Status:** Accepted

## Context

The platform requires email/password authentication (Argon2id hashing), Google and LinkedIn OAuth, email verification, password reset, optional 2FA (RFC 6238 TOTP), device/session management with instant revocation, and strict age-gate compliance at signup.
We evaluated **Better Auth** vs **Auth.js (v5)**.

## Decision

We select **Better Auth** with the Drizzle ORM PostgreSQL adapter.

## Comparison & Rationale

| Evaluation Criterion                | Better Auth                                                                                                   | Auth.js (v5 / NextAuth)                                                                                      |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------- |
| **Architectural Compatibility**     | Designed for both standalone Node/NestJS backend APIs and Next.js fullstack. Client and server are decoupled. | Heavily coupled to Next.js App Router route handlers and server actions; awkward to verify in NestJS guards. |
| **Two-Factor Auth (2FA / TOTP)**    | Native 2FA plugin with TOTP generator, QR code output, and backup recovery codes built-in.                    | Requires manual custom implementation with external libraries (`otplib`, manual schema).                     |
| **Session Management & Revocation** | First-class session management, device tracking, active session listing, and granular session revocation.     | Primarily JWT-cookie focused; database sessions require complex session callbacks.                           |
| **Argon2id Support**                | Built-in password hashing customization supporting Argon2id (`m=65536, t=3, p=4`).                            | Defaults to bcrypt or requires manual credential provider hashing.                                           |
| **Drizzle Adapter**                 | Official, zero-overhead Drizzle schema generator and adapter.                                                 | Adapter exists, but breaking changes between v4 and v5 have caused ecosystem instability.                    |
| **Age-Gate Custom Fields**          | Native support for custom registration fields (`ageConfirmed`, `ageConfirmedAt`, `agePolicyVersion`).         | Requires custom credentials callback override.                                                               |

## Consequences

- Better Auth handles core session tokens, password hashing, and OAuth flows.
- NestJS uses a lightweight guard to validate sessions directly against PostgreSQL / Redis cache.
- Passwords are strictly hashed with Argon2id.
