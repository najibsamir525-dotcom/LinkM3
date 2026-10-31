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

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
