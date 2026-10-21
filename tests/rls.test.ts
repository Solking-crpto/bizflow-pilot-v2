import { describe, it, expect } from "vitest";
import { getDb } from "@/lib/db";

describe("Database Security - Row Level Security (RLS) Verification", () => {
  it("fails if any table in schema v2_testnet has Row Level Security disabled", async () => {
    const db = getDb("testnet");
    const result = await db.$queryRaw<Array<{ tablename: string; rls_enabled: boolean }>>`
      SELECT c.relname as tablename, c.relrowsecurity as rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'v2_testnet'
        AND c.relkind = 'r'
        AND c.relname != '_prisma_migrations';
    `;

    expect(result.length).toBeGreaterThan(0);

    const unprotectedTables = result.filter((r) => !r.rls_enabled).map((r) => r.tablename);

    if (unprotectedTables.length > 0) {
      throw new Error(
        `[SECURITY ERROR] The following tables in schema 'v2_testnet' have Row Level Security DISABLED:\n` +
          unprotectedTables.map((t) => ` - ${t}`).join("\n") +
          `\n\nRun 'scripts/secure-schemas.ps1' to enable RLS across all tables and revoke anon/authenticated access.`
      );
    }

    expect(unprotectedTables).toEqual([]);
  });
});
