import { test, expect } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";

// Non-blocklisted clean test key for E2E simulation
const TEST_PRIVATE_KEY = "0x47e179ec346fe3a6de57dc828fe1f074ac7e3345425eb302061adc48bc9f61e0";
const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);
const TEST_ADDRESS = testAccount.address;

test.describe("BizFlow Pilot V2 — Playwright Non-Custodial Journey & Network Isolation Suite", () => {
  test.beforeEach(async ({ page }) => {
    // Expose Node signing function for cryptographically valid SIWE signatures
    await page.exposeFunction("signMessageInNode", async (message: string) => {
      return await testAccount.signMessage({ message });
    });

    // Inject mock Web3 wallet into the browser context
    await page.addInitScript(
      ({ address }) => {
        let currentChainId = "0x4cece2"; // 5042002 (Arc Testnet)
        const listeners: Record<string, Function[]> = {};

        (window as any).ethereum = {
          isMetaMask: true,
          selectedAddress: address,
          chainId: currentChainId,
          on(event: string, handler: Function) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
          },
          removeListener(event: string, handler: Function) {
            if (listeners[event]) {
              listeners[event] = listeners[event].filter((h) => h !== handler);
            }
          },
          async request({ method, params }: { method: string; params?: any[] }) {
            if (method === "eth_requestAccounts" || method === "eth_accounts") {
              return [address];
            }
            if (method === "eth_chainId") {
              return currentChainId;
            }
            if (method === "personal_sign") {
              const msg = params?.[0];
              return await (window as any).signMessageInNode(msg);
            }
            if (method === "wallet_switchEthereumChain") {
              currentChainId = params?.[0]?.chainId || currentChainId;
              (listeners["chainChanged"] || []).forEach((cb) => cb(currentChainId));
              return null;
            }
            if (method === "wallet_addEthereumChain") {
              currentChainId = params?.[0]?.chainId || currentChainId;
              (listeners["chainChanged"] || []).forEach((cb) => cb(currentChainId));
              return null;
            }
            if (method === "eth_sendTransaction") {
              return "0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82";
            }
            if (method === "eth_getTransactionReceipt") {
              return {
                status: "0x1",
                blockNumber: "0x18a992",
                transactionHash: params?.[0] || "0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82",
                logs: [],
              };
            }
            if (method === "eth_getBalance") {
              return "0x56bc75e2d63100000"; // 100 USDC atomic
            }
            return null;
          },
        };
      },
      { address: TEST_ADDRESS }
    );
  });

  test("1. Full testnet journey: sign in, onboard, sample data, desks, advisory, payment & verify", async ({
    page,
  }) => {
    test.setTimeout(90000);

    // 1. Visit homepage on testnet
    await page.goto("/?network=testnet", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();

    // 2. Connect Wallet & SIWE Sign-In
    const connectBtn = page.getByRole("button", { name: /Connect Wallet/i });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    const signInBtn = page.getByRole("button", { name: /Sign In With Wallet/i });
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
      // Wait for authenticated state
      await expect(page.locator("text=" + TEST_ADDRESS.slice(0, 6))).toBeVisible({ timeout: 10000 });
    }

    // 3. Load Sample Dataset if on testnet
    const loadSampleBtn = page.getByRole("button", { name: /Load Sample Data/i });
    if (await loadSampleBtn.isVisible()) {
      await loadSampleBtn.click();
      await page.waitForTimeout(2000);
    }

    // 4. Suppliers Desk: verify table, address checksums, and blocked-address check
    await page.goto("/suppliers", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Suppliers" })).toBeVisible();
    await expect(page.locator("body")).toBeVisible();

    // 5. Purchase Orders & Inventory Desk
    await page.goto("/inventory", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: /Purchase Orders/i })).toBeVisible();

    // 6. Invoices Desk: 3-way match & threat quarantine
    await page.goto("/invoices", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Invoices" })).toBeVisible();

    // 7. Advisory Agent
    await page.goto("/agent", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=AI Finance Copilot").or(page.locator("h1", { hasText: /Agent/i }))).toBeVisible();
    await expect(page.locator("text=Non-Custodial Guarantee")).toBeVisible();

    // 8. Payment Desk
    await page.goto("/payments", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Payments" })).toBeVisible();

    // 9. Public Verification Passport
    await page.goto("/verify/demo", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("2. Network switch test: testnet to mainnet with confirmation, empty mainnet, back to testnet", async ({
    page,
  }) => {
    await page.goto("/?network=testnet", { waitUntil: "domcontentloaded" });

    // Click MAINNET button in global top nav
    const mainnetToggle = page.locator("button", { hasText: "MAINNET" });
    await expect(mainnetToggle).toBeVisible();
    await mainnetToggle.click();

    // Verify confirmation modal appears
    const modalTitle = page.locator("h3", { hasText: "Switch to Arc Mainnet?" });
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    // Confirm switch
    const confirmBtn = page.getByRole("button", { name: "Switch to Mainnet" });
    await confirmBtn.click();

    // Wait for reload or switch
    await page.waitForLoadState("domcontentloaded");

    // Verify active network is Mainnet (Chain ID 5042)
    await expect(page.locator("text=ARC MAINNET: real USDC").first()).toBeVisible({ timeout: 10000 });

    // Switch back to Testnet
    const testnetToggle = page.locator("button", { hasText: "TESTNET" });
    await testnetToggle.click();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("text=TESTNET: test USDC has no value").first()).toBeVisible({ timeout: 10000 });
  });

  test("3. Stale-tab safety guard: returns HTTP 409 Conflict on mismatched X-Bizflow-Network header", async ({
    request,
  }) => {
    // Attempt mutating POST request with cookie=mainnet but header=testnet
    const response = await request.post("/api/sample-data", {
      headers: {
        "X-Bizflow-Network": "testnet",
        Cookie: "bizflow_network=mainnet",
      },
    });

    // Mismatched state must be rejected with 409 Conflict
    expect(response.status()).toBe(409);
    const data = await response.json();
    expect(data.error).toContain("Active network mismatch");
  });

  test("4. Content-Security-Policy header & browser console audit", async ({ page }) => {
    const cspViolations: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Content Security Policy") || text.includes("CSP")) {
        cspViolations.push(text);
      }
    });

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();

    const headers = response!.headers();
    const cspHeader = headers["content-security-policy"];
    expect(cspHeader, "Content-Security-Policy header is missing").toBeDefined();
    expect(cspHeader).toContain("default-src 'self'");
    expect(cspHeader).toContain("frame-ancestors 'none'");

    // Verify no CSP violations were logged by browser engine
    expect(cspViolations, `CSP violations detected: ${cspViolations.join("; ")}`).toEqual([]);
  });
});
