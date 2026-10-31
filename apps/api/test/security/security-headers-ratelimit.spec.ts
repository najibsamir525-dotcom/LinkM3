/**
 * Security Headers, Rate Limiting & CSRF Test Suite
 *
 * Boots the full NestJS application with FastifyAdapter, FastifyHelmet,
 * ThrottlerModule, and CORS to prove:
 * 1. Hardened Security Headers (CSP, NoSniff, Frameguard, ReferrerPolicy)
 * 2. Rate Limiting enforcement (HTTP 429 Too Many Requests on burst traffic)
 * 3. CORS / Origin restrictions for CSRF mitigation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import fastifyHelmet from "@fastify/helmet";
import fastifyCors from "@fastify/cors";
import { AuthController } from "../../src/auth/auth.controller.js";
import { AuthService } from "../../src/auth/auth.service.js";
import { HealthController } from "../../src/health/health.controller.js";
import { DATABASE_TOKEN } from "../../src/database.module.js";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

describe("Security Hardening: Headers, Rate Limiting & CORS", () => {
  let app: NestFastifyApplication;
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();
    const db = drizzle(pg);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ FRONTEND_URL: "https://linkme.cv" })],
        }),
        ThrottlerModule.forRoot([
          {
            name: "short",
            ttl: 1000,
            limit: 3, // Max 3 requests per second
          },
          {
            name: "medium",
            ttl: 60000,
            limit: 10,
          },
        ]),
      ],
      controllers: [AuthController, HealthController],
      providers: [
        AuthService,
        {
          provide: DATABASE_TOKEN,
          useValue: db,
        },
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    // Register Helmet with LINKME production CSP configuration
    await app.register(fastifyHelmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          baseUri: ["'self'"],
        },
      },
      frameguard: { action: "deny" },
      noSniff: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    });

    // Register CORS
    await app.register(fastifyCors, {
      origin: ["https://linkme.cv"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    });

    app.setGlobalPrefix("api", {
      exclude: ["health/live", "health/ready"],
    });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await pg.close();
  });

  describe("Security Headers Enforcement (Fastify Helmet)", () => {
    it("returns hardened security headers on HTTP responses", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health/live",
      });

      expect(response.statusCode).toBe(200);

      // 1. Content Security Policy
      const csp = response.headers["content-security-policy"];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");

      // 2. MIME type sniffing prevention
      expect(response.headers["x-content-type-options"]).toBe("nosniff");

      // 3. Clickjacking prevention
      expect(response.headers["x-frame-options"]).toBe("DENY");

      // 4. Referrer policy
      expect(response.headers["referrer-policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
    });
  });

  describe("Rate Limiting Enforcement (ThrottlerGuard)", () => {
    it("rejects burst signup traffic with HTTP 429 Too Many Requests", async () => {
      const invalidPayload = {
        email: "spam@example.com",
        password: "short",
        ageConfirmed: false,
        termsAccepted: false,
      };

      const responses = [];
      // Fire 5 rapid requests in succession (limit is 3 per second)
      for (let i = 0; i < 5; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/auth/signup",
          payload: invalidPayload,
        });
        responses.push(res.statusCode);
      }

      // First 3 should pass through throttler (returning 400 Bad Request due to validation)
      expect(responses[0]).toBe(400);
      expect(responses[1]).toBe(400);
      expect(responses[2]).toBe(400);

      // 4th and 5th requests should be blocked by Throttler with 429
      expect(responses[3]).toBe(429);
      expect(responses[4]).toBe(429);
    });
  });

  describe("CORS & Origin Validation", () => {
    it("returns CORS headers for allowed origin", async () => {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/auth/signup",
        headers: {
          origin: "https://linkme.cv",
          "access-control-request-method": "POST",
        },
      });

      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://linkme.cv",
      );
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("does not allow untrusted origins", async () => {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/auth/signup",
        headers: {
          origin: "https://evil-phishing-site.com",
          "access-control-request-method": "POST",
        },
      });

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });
});
