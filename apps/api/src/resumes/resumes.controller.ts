/**
 * LINKME API — Resumes Controller
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { AuthGuard } from "../common/guards/auth.guard.js";
import {
  ResumesService,
  CreateResumeDto,
  AutosaveResumeDto,
  ResumeResponse,
} from "./resumes.service.js";

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
  };
}

@Controller("api/v1/resumes")
@UseGuards(AuthGuard)
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateResumeDto,
  ): Promise<ResumeResponse> {
    return this.resumesService.createResume(req.user.id, dto);
  }

  @Get(":id")
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<ResumeResponse> {
    return this.resumesService.getResume(req.user.id, id);
  }

  @Put(":id/autosave")
  async autosave(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AutosaveResumeDto,
  ): Promise<ResumeResponse> {
    return this.resumesService.autosave(req.user.id, id, dto);
  }
}
