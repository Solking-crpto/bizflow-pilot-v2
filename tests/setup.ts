import { assertTestDatabaseSafety } from "../lib/db";

// Enforce that test runs operate exclusively against testnet via TEST_NETWORK
process.env.TEST_NETWORK = "testnet";

// Enforce that tests abort immediately if DATABASE_URL or DIRECT_URL targets mainnet
assertTestDatabaseSafety();
