/**
 * LINKME API — Database Module
 *
 * Provides the Drizzle ORM database instance as a NestJS injectable.
 * Uses the postgres.js driver connected to PostgreSQL 16.
 */

import { Module, Global, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDb, type Database } from "@linkme/db";

export const DATABASE_TOKEN = Symbol("DATABASE");

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (config: ConfigService): Database => {
        const url = config.get<string>("DATABASE_URL");
        if (!url) {
          throw new Error("DATABASE_URL environment variable is required");
        }
        return createDb(url, { max: 10, idle_timeout: 30 });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule implements OnModuleDestroy {
  // Note: postgres.js handles connection cleanup automatically
  // when the process exits. For explicit cleanup, we would need
  // to store a reference to the sql client.
  onModuleDestroy(): void {
    // Connection pool cleanup is handled by postgres.js
    // on process exit via its internal cleanup hooks.
  }
}
