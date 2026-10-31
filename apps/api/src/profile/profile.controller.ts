/**
 * LINKME API — Profile Controller
 *
 * REST endpoints for Master Profile CRUD.
 */

import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ProfileService } from "./profile.service.js";
import {
  AuthGuard,
  type AuthenticatedRequest,
} from "../common/guards/auth.guard.js";
import type { FastifyRequest } from "fastify";

@ApiTags("profile")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(":userId")
  @ApiOperation({ summary: "Get user profile" })
  @ApiParam({ name: "userId", type: "string", format: "uuid" })
  @ApiResponse({ status: 200, description: "Profile returned." })
  @ApiResponse({
    status: 403,
    description: "Cannot access another user's profile.",
  })
  @ApiResponse({ status: 404, description: "Profile not found." })
  async getProfile(
    @Param("userId") userId: string,
    @Req() req: FastifyRequest,
  ) {
    const requestingUserId = (req as AuthenticatedRequest).userId ?? userId;
    return this.profileService.getProfile(userId, requestingUserId);
  }

  @Put(":userId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update user profile" })
  @ApiParam({ name: "userId", type: "string", format: "uuid" })
  @ApiResponse({ status: 200, description: "Profile updated." })
  @ApiResponse({
    status: 403,
    description: "Cannot update another user's profile.",
  })
  async updateProfile(
    @Param("userId") userId: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    const requestingUserId = (req as AuthenticatedRequest).userId ?? userId;
    return this.profileService.updateProfile(userId, requestingUserId, body);
  }
}
