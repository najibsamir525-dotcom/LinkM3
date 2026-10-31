/**
 * LINKME API — Root Application Module
 */

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { HealthModule } from "./health/health.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ProfileModule } from "./profile/profile.module.js";
import { DatabaseModule } from "./database.module.js";

@Module({
  imports: [
    // ── Environment Variables ────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      cache: true,
    }),

    // ── Rate Limiting (per-IP) ───────────────────────────────────
    // Default: 100 requests per 60 seconds per IP
    // Auth endpoints use tighter per-route limits
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: "medium",
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: "long",
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),

    // ── Database ─────────────────────────────────────────────────
    DatabaseModule,

    // ── Feature Modules ──────────────────────────────────────────
    HealthModule,
    AuthModule,
    ProfileModule,
  ],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
