/**
 * LINKME API — Application Entry Point
 *
 * NestJS + Fastify adapter with security hardening.
 * Security headers, CORS, rate limiting, and graceful shutdown.
 */

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Trust first proxy (CDN/load balancer) for X-Forwarded-For
      trustProxy: true,
    }),
    {
      // Better Auth handles its own body parsing for auth routes
      bodyParser: true,
      logger: ["error", "warn", "log"],
    },
  );

  // ── Security Headers (Helmet via Fastify plugin) ─────────────────
  await app.register((await import("@fastify/helmet")).default, {
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
    // Prevent clickjacking
    frameguard: { action: "deny" },
    // Prevent MIME type sniffing
    noSniff: true,
    // Referrer policy for privacy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });

  // ── CORS ─────────────────────────────────────────────────────────
  const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:3000";
  await app.register((await import("@fastify/cors")).default, {
    origin: [frontendUrl],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    maxAge: 86400,
  });

  // ── OpenAPI / Swagger (development only) ─────────────────────────
  if (process.env["NODE_ENV"] !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("LINKME API")
      .setDescription("CV/Resume Builder Platform API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .addTag("health", "Health checks")
      .addTag("auth", "Authentication & registration")
      .addTag("profile", "Master Profile CRUD")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  // ── Global Prefix ────────────────────────────────────────────────
  app.setGlobalPrefix("api", {
    exclude: ["health/live", "health/ready", "docs"],
  });

  // ── Graceful Shutdown ────────────────────────────────────────────
  app.enableShutdownHooks();

  const port = parseInt(process.env["PORT"] ?? "4000", 10);
  await app.listen(port, "0.0.0.0");

  console.log(`🚀 LINKME API running on http://0.0.0.0:${port}`);
  if (process.env["NODE_ENV"] !== "production") {
    console.log(`📖 Swagger docs at http://localhost:${port}/docs`);
  }
}

bootstrap().catch((err: unknown) => {
  console.error("Fatal: Failed to start LINKME API", err);
  process.exit(1);
});
