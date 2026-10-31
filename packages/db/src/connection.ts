/**
 * LINKME Platform — Database Connection
 *
 * Uses the `postgres` (postgres.js) driver with Drizzle ORM.
 * Connection configuration is read from the DATABASE_URL environment variable.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

/**
 * Creates a postgres.js connection and wraps it with Drizzle ORM.
 *
 * @param connectionString - PostgreSQL connection string.
 *   Defaults to DATABASE_URL from the environment.
 * @param options - Additional postgres.js connection options.
 */
export function createDb(
  connectionString?: string,
  options?: { max?: number; idle_timeout?: number },
) {
  const url = connectionString ?? process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provide a connection string or set the DATABASE_URL environment variable.",
    );
  }

  const client = postgres(url, {
    max: options?.max ?? 10,
    idle_timeout: options?.idle_timeout ?? 30,
    // Prevent implicit type coercion bugs
    transform: { undefined: null },
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
