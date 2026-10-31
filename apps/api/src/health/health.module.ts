/**
 * LINKME API — Health Check Module
 *
 * Provides /health/live and /health/ready endpoints.
 * - /health/live: Always returns 200 (process is alive)
 * - /health/ready: Returns 200 only when DB is connected
 */

import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
