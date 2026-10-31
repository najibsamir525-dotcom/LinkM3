/**
 * LINKME API — Auth Module
 *
 * Integrates Better Auth for:
 * - Email/password signup with age gate & consent
 * - Email verification
 * - Password reset
 * - Google & LinkedIn OAuth (configured but disabled without keys)
 * - Optional TOTP 2FA
 * - Database-backed sessions
 *
 * Better Auth manages its own routes via a catch-all handler.
 * Additional LINKME-specific auth logic (age gate enforcement,
 * consent recording) is handled in AuthController.
 */

import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { DATABASE_TOKEN } from "../database.module.js";
import { createBetterAuth } from "./better-auth.config.js";
import type { Database } from "@linkme/db";

export const BETTER_AUTH_TOKEN = "BETTER_AUTH_TOKEN";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: BETTER_AUTH_TOKEN,
      inject: [DATABASE_TOKEN],
      useFactory: (db: Database) => createBetterAuth(db),
    },
  ],
  exports: [AuthService, BETTER_AUTH_TOKEN],
})
export class AuthModule {}
