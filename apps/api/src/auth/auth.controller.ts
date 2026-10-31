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
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service.js";
import type { FastifyRequest } from "fastify";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 5, ttl: 60000 },
  })
  @ApiOperation({
    summary: "Register a new user account",
    description:
      "Creates a new user with email/password, age gate confirmation (18+), " +
      "and Terms of Service acceptance. Sends a verification email.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password", "ageConfirmed", "termsAccepted"],
      properties: {
        email: { type: "string", format: "email" },
        password: {
          type: "string",
          minLength: 12,
          maxLength: 128,
        },
        ageConfirmed: {
          type: "boolean",
          enum: [true],
          description: "Must be true — confirms user is at least 18 years old",
        },
        termsAccepted: {
          type: "boolean",
          enum: [true],
          description:
            "Must be true — accepts Terms of Service and Privacy Policy",
        },
        policyVersion: {
          type: "string",
          default: "v1.0",
        },
        locale: {
          type: "string",
          enum: ["en", "ar"],
          default: "en",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "User created successfully. Verification email sent.",
  })
  @ApiResponse({
    status: 400,
    description: "Validation error or email already in use.",
  })
  @ApiResponse({
    status: 429,
    description: "Too many signup attempts. Try again later.",
  })
  async signup(@Body() body: unknown) {
    return this.authService.signup(body);
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
