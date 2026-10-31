/**
 * LINKME API — Health Check Controller
 */

import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { sql } from "drizzle-orm";
import { DATABASE_TOKEN } from "../database.module.js";
import type { Database } from "@linkme/db";

@ApiTags("health")
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE_TOKEN) private readonly db: Database) {}

  @Get("live")
  @ApiOperation({ summary: "Liveness probe — is the process running?" })
  @ApiResponse({ status: 200, description: "Process is alive" })
  getLive(): { status: string; timestamp: string } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  @ApiOperation({
    summary: "Readiness probe — can the API serve requests?",
  })
  @ApiResponse({ status: 200, description: "API is ready" })
  @ApiResponse({ status: 503, description: "API is not ready" })
  async getReady(): Promise<{
    status: string;
    timestamp: string;
    database: string;
  }> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: "connected",
      };
    } catch {
      return {
        status: "degraded",
        timestamp: new Date().toISOString(),
        database: "disconnected",
      };
    }
  }
}
