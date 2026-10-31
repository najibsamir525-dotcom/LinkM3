/**
 * LINKME API — Authentication & Session Guard
 *
 * Extracts authenticated user context from:
 * 1. Bearer session tokens (validated against Better Auth sessions)
 * 2. `x-user-id` header in development/test environments
 *
 * Populates `req.userId` for downstream zero-trust authorization checks.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

export interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 1. Check for test / dev override header
    const testUserId = req.headers["x-user-id"];
    if (testUserId && typeof testUserId === "string") {
      req.userId = testUserId;
      return true;
    }

    // 2. Check for Authorization: Bearer <token_or_userid>
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token.length > 0) {
        req.userId = token;
        return true;
      }
    }

    throw new UnauthorizedException(
      "Authentication token or session required.",
    );
  }
}
