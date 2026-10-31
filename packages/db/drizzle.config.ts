import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env["DATABASE_URL"] ??
      "postgresql://linkme_user:linkme_secret_pass@localhost:5432/linkme_db",
  },
  verbose: true,
  strict: true,
});
