import { assertTestDatabaseSafety } from "../lib/db";

// Enforce that tests abort immediately if DATABASE_URL or DIRECT_URL targets mainnet
assertTestDatabaseSafety();
