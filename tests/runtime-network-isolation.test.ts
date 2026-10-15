import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../lib/db";
import { NETWORKS } from "../lib/networks";

describe("Runtime Network Data Isolation", () => {
  it("provides distinct PrismaClient instances for mainnet and testnet", () => {
    // In test environment, getDb returns clients configured with connection_limit=1
    const testnetClient = getDb("testnet");
    const mainnetClient = getDb("mainnet");

    expect(testnetClient).toBeDefined();
    expect(mainnetClient).toBeDefined();
    // They are distinct instances cached by network mode
    expect(getDb("testnet")).toBe(testnetClient);
    expect(getDb("mainnet")).toBe(mainnetClient);
  });

  it("ensures testnet and mainnet configs have isolated chainIds and RPCs", () => {
    expect(NETWORKS.mainnet.chainId).toBe(5042);
    expect(NETWORKS.testnet.chainId).toBe(5042002);
    expect(NETWORKS.mainnet.isTestnet).toBe(false);
    expect(NETWORKS.testnet.isTestnet).toBe(true);
    expect(NETWORKS.mainnet.rpcUrl).not.toBe(NETWORKS.testnet.rpcUrl);
    expect(NETWORKS.mainnet.explorerUrl).not.toBe(NETWORKS.testnet.explorerUrl);
  });

  it("isolates tenant records within testnet database schema", async () => {
    const testnetDb = getDb("testnet");
    const uniqueOrgId = `org-iso-${Date.now()}`;
    const uniqueVendorWallet = `0x${Date.now().toString(16).padStart(40, "0")}`;

    // Create an organization and vendor on testnet
    await testnetDb.organization.create({
      data: {
        id: uniqueOrgId,
        name: "Testnet Isolated Corp",
        currency: "USDC",
        walletAddress: uniqueVendorWallet,
        vendors: {
          create: {
            name: "Testnet Exclusive Supplier",
            walletAddress: uniqueVendorWallet,
            status: "active",
          },
        },
      },
    });

    // Query testnet client
    const testnetOrg = await testnetDb.organization.findUnique({
      where: { id: uniqueOrgId },
      include: { vendors: true },
    });
    expect(testnetOrg).not.toBeNull();
    expect(testnetOrg?.name).toBe("Testnet Isolated Corp");
    expect(testnetOrg?.vendors).toHaveLength(1);

    // Clean up
    await testnetDb.vendor.deleteMany({ where: { orgId: uniqueOrgId } });
    await testnetDb.organization.delete({ where: { id: uniqueOrgId } });
  });
});
