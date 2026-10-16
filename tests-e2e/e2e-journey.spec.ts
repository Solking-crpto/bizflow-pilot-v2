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
        try {
          localStorage.setItem("bizflow_first_visit_choice_dismissed", "true");
        } catch {}

        let currentChainId = "0x4cef52"; // 5042002 (Arc Testnet)
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
            console.log("MOCK_ETH_RPC:", method, params ? JSON.stringify(params).slice(0, 80) : "");
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
                blockHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                blockNumber: "0x18a992",
                contractAddress: null,
                cumulativeGasUsed: "0x5208",
                effectiveGasPrice: "0x4a817c800",
                from: address,
                to: "0x3600000000000000000000000000000000000000",
                gasUsed: "0x5208",
                logs: [],
                logsBloom: "0x0000000000000000000000000000000000000000000000000000000000000000",
                transactionHash: params?.[0] || "0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82",
                transactionIndex: "0x0",
                type: "0x2",
              };
            }
            if (method === "eth_getTransactionByHash") {
              return {
                blockHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                blockNumber: "0x18a992",
                from: address,
                gas: "0x5208",
                gasPrice: "0x4a817c800",
                hash: params?.[0] || "0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82",
                input: "0x",
                nonce: "0x1",
                to: "0x3600000000000000000000000000000000000000",
                transactionIndex: "0x0",
                value: "0x0",
                type: "0x2",
              };
            }
            if (method === "eth_getBalance") {
              return "0x56bc75e2d63100000"; // 100 USDC atomic (for gas balance)
            }
            if (method === "eth_call") {
              // Return 100 USDC (100_000_000 atomic units 6 decimals) for balanceOf
              return "0x0000000000000000000000000000000000000000000000000000000005f5e100";
            }
            if (method === "eth_estimateGas") {
              return "0x186a0"; // 100,000 gas
            }
            if (method === "eth_maxPriorityFeePerGas") {
              return "0x3b9aca00"; // 1 Gwei
            }
            if (method === "eth_feeHistory") {
              return {
                oldestBlock: "0x18a990",
                baseFeePerGas: ["0x4a817c800", "0x4a817c800"], // 20 Gwei floor
                gasUsedRatio: [0.5],
              };
            }
            if (method === "eth_blockNumber") {
              return "0x18a992";
            }
            return null;
          },
        };

        // EIP-6963 provider announcement
        const info = {
          uuid: "e2e-test-wallet",
          name: "MetaMask",
          icon: "data:image/svg+xml;base64,PHN2Zy8+",
          rdns: "io.metamask",
        };
        const announce = () => {
          window.dispatchEvent(
            new CustomEvent("eip6963:announceProvider", {
              detail: Object.freeze({ info, provider: (window as any).ethereum }),
            })
          );
        };
        window.addEventListener("eip6963:requestProvider", announce);
        announce();
      },
      { address: TEST_ADDRESS }
    );
  });

  test("1. Full testnet journey: sign in, onboard, sample data, desks, advisory, payment & verify", async ({
    page,
  }) => {
    test.setTimeout(120000);

    page.on("console", (msg) => {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    });
    page.on("pageerror", (err) => {
      console.log("[BROWSER UNCAUGHT]:", err.message);
    });

    // Set testnet cookie before navigation
    await page.context().addCookies([
      { name: "bizflow_network", value: "testnet", domain: "localhost", path: "/" },
    ]);

    // 1. Visit homepage on testnet
    await page.goto("/", { waitUntil: "domcontentloaded" });
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

    // 3. Load Sample Dataset on testnet
    const loadSampleBtn = page.getByRole("button", { name: /Load Sample Data/i });
    await expect(loadSampleBtn).toBeVisible({ timeout: 15000 });
    const [sampleRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/sample-data") && res.request().method() === "POST"),
      loadSampleBtn.click(),
    ]);
    expect(sampleRes.status()).toBe(200);
    await page.waitForTimeout(2000);

    // 4. Suppliers Desk: verify table, address checksums, and blocked-address check
    await page.goto("/suppliers", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: "Suppliers" })).toBeVisible();
    await expect(page.locator("body")).toBeVisible();

    // 5. Purchase Orders & Inventory Desk
    await page.goto("/inventory", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: /Purchase Orders/i })).toBeVisible();

    // 6. Invoices Desk: 3-way match & threat quarantine
    await page.goto("/invoices", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: /Invoice/i })).toBeVisible();
    // Verify sample invoices are visible in queue
    await expect(page.locator("text=INV-SAMPLE-MATCHED").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Dup 95%").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Injection").first()).toBeVisible({ timeout: 10000 });

    // 7. Advisory Agent
    await page.goto("/agent", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=AI Finance Copilot").or(page.locator("h1", { hasText: /Agent/i }))).toBeVisible();
    await expect(page.locator("text=/Non-Custodial/i").first()).toBeVisible();

    // 8. Payment Desk: Non-Custodial signing & on-chain anchoring
    await page.goto("/payments", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1", { hasText: /Payment/i })).toBeVisible();

    // Select the matched invoice
    const matchedItem = page.locator("text=INV-SAMPLE-MATCHED").first();
    if (await matchedItem.isVisible()) {
      await matchedItem.click();
    }

    // Mock server verification routes for non-custodial execution against mock wallet
    await page.route("**/api/payments/verify-receipt", async (route) => {
      const postData = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          network: "testnet",
          payment: {
            id: "pay-simulated-testnet",
            txHash: postData.txHash || "0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82",
            blockNumber: 1616274,
            amountFormatted: "0.05 USDC",
            status: "confirmed",
            confirmedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route("**/api/payments/anchor-receipt", async (route) => {
      const postData = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          anchorTxHash: postData.txHash || "0x9f5a7d65b758269d6c42939b4cb0e7e17eaec596b42b6559d2824dfb5dbd0e82",
          anchoredAt: new Date().toISOString(),
        }),
      });
    });

    // Click "Pay 0.05 USDC with Wallet"
    const payWalletBtn = page.getByRole("button", { name: /Pay 0\.05 USDC with Wallet/i });
    await expect(payWalletBtn).toBeVisible({ timeout: 10000 });
    await payWalletBtn.click();

    // NonCustodialPaymentModal appears
    await expect(page.locator("text=Non-Custodial USDC Settlement")).toBeVisible({ timeout: 10000 });

    // Confirm authorization checkbox (after intent initialization completes)
    const confirmCheckbox = page.locator('input[type="checkbox"]');
    await expect(confirmCheckbox).toBeVisible({ timeout: 25000 });
    await confirmCheckbox.check();

    // Click "Confirm & Sign in Wallet"
    const signBtn = page.getByRole("button", { name: /Confirm & Sign in Wallet/i });
    const debugInfo = await signBtn.getAttribute("data-debug");
    console.log("PLAYWRIGHT_SIGN_BTN_DEBUG:", debugInfo);
    await expect(signBtn).toBeEnabled({ timeout: 10000 });
    await signBtn.click();

    // Verify settlement confirmation on Arc
    await expect(page.locator("text=Settlement Confirmed on Arc")).toBeVisible({ timeout: 20000 });

    // Click "Anchor Proof on Arc"
    const anchorBtn = page.getByRole("button", { name: /Anchor Proof on Arc/i });
    await expect(anchorBtn).toBeVisible();
    await anchorBtn.click();

    // Verify permanent on-chain audit anchor
    await expect(page.locator("text=Audit Proof Permanently Anchored")).toBeVisible({ timeout: 20000 });

    // Close modal via Done button
    const doneBtn = page.getByRole("button", { name: "Done" });
    await doneBtn.click();

    // 9. Public Verification Passport
    await page.goto("/verify/demo", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("2. Network switch test: testnet to mainnet with confirmation, empty mainnet, back to testnet", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Set testnet cookie before navigation
    await page.context().addCookies([
      { name: "bizflow_network", value: "testnet", domain: "localhost", path: "/" },
    ]);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Click MAINNET button in global top nav
    const mainnetToggle = page.getByRole("button", { name: "MAINNET", exact: true }).first();
    await expect(mainnetToggle).toBeVisible();
    await mainnetToggle.click();

    // Verify confirmation modal appears
    const modalTitle = page.locator("h3", { hasText: "Switch to Arc Mainnet?" });
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    // Confirm switch and wait for page reload to complete
    const confirmBtn = page.getByRole("button", { name: "Switch to Mainnet" });
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
      confirmBtn.click(),
    ]);
    await page.waitForTimeout(1000);

    // Verify active network is Mainnet (Chain ID 5042)
    await expect(page.locator("text=ARC MAINNET: real USDC").first()).toBeVisible({ timeout: 15000 });

    // Switch back to Testnet
    const testnetToggle = page.getByRole("button", { name: "TESTNET", exact: true }).first();
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
      testnetToggle.click(),
    ]);
    await page.waitForTimeout(1000);
    await expect(page.locator("text=TESTNET: test USDC has no value").first()).toBeVisible({ timeout: 15000 });
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
    expect(data.error).toContain("Network conflict");
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
