/**
 * LINKME API — Auth Controller
 *
 * REST endpoints for authentication flows.
 * Rate-limited more aggressively than general endpoints.
 */

import {
  Controller,
  Post,
  Delete,
  Req,
  HttpCode,
  HttpStatus,
  GoneException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service.js";
import type { FastifyRequest } from "fastify";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @HttpCode(HttpStatus.GONE)
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 5, ttl: 60000 },
  })
  @ApiOperation({
    summary: "Decommissioned legacy signup endpoint",
    description:
      "Direct registration at /auth/signup has been permanently retired. " +
      "Registration is exclusively handled by Better Auth at /api/auth/sign-up/email per ADR-002.",
    deprecated: true,
  })
  @ApiResponse({
    status: 410,
    description:
      "Endpoint retired. All signups must use /api/auth/sign-up/email.",
  })
  async signup(): Promise<never> {
    throw new GoneException(
      "Direct /auth/signup endpoint is retired. Registration is exclusively handled by Better Auth at /api/auth/sign-up/email.",
    );
  }

  @Delete("account")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({
    short: { limit: 1, ttl: 1000 },
    medium: { limit: 3, ttl: 60000 },
  })
  @ApiOperation({
    summary: "Request account deletion (GDPR Article 17)",
    description:
      "Marks the account for deletion with a 7-day grace period. " +
      "After 7 days, all user data is permanently erased.",
  })
  @ApiResponse({ status: 204, description: "Deletion request accepted." })
  @ApiResponse({ status: 401, description: "Not authenticated." })
  async deleteAccount(@Req() req: FastifyRequest): Promise<void> {
    // TODO: Extract user ID from session once Better Auth session middleware is integrated
    // For now, this is a placeholder that will be wired up with the auth guard
    const userId = (req as FastifyRequest & { userId?: string }).userId;
    if (!userId) {
      throw new Error("Authentication required");
    }
    await this.authService.deleteAccount(userId);
  }
}
