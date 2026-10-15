import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { NETWORKS } from "@/lib/networks";
import { validateApiNetwork } from "@/lib/api-guard";
import { runAgentAnalysis } from "@/lib/agent/recommender";
import { evaluatePaymentTiming } from "@/lib/agent/timing";

export const dynamic = "force-dynamic";

const APP_DAILY_LLM_LIMIT = parseInt(process.env.LLM_DAILY_CALL_LIMIT || "100", 10);
const ORG_DAILY_LLM_LIMIT = 20;

import { getClientIp, checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const apiCheck = validateApiNetwork(req);
    if (apiCheck.errorResponse) return apiCheck.errorResponse;
    const { network: networkMode, db } = apiCheck;

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Please connect your wallet" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const rlIp = checkRateLimit(`agent:analyze:ip:${ip}`, 30, 60_000);
    if (!rlIp.allowed) return rateLimitExceededResponse(rlIp.retryAfterSeconds);

    const rlWallet = checkRateLimit(`agent:analyze:wallet:${session.address}`, 20, 60_000);
    if (!rlWallet.allowed) return rateLimitExceededResponse(rlWallet.retryAfterSeconds);

    const org = await getSessionOrg(session, networkMode);
    if (!org) {
      return NextResponse.json({ error: "No organization found for this wallet" }, { status: 404 });
    }

    const networkConfig = NETWORKS[networkMode];

    // 1. Fetch Organization's Open (Unpaid) Invoices
    const invoices = await withDbTimeout(() =>
      db.invoice.findMany({
        where: {
          orgId: org.id,
          status: { in: ["verified", "review_required", "blocked"] },
        },
        include: {
          vendor: true,
          purchaseOrder: {
            include: {
              lines: { include: { item: true } },
              goodsReceipts: { include: { lines: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    );

    // 2. Query Connected Wallet USDC Balance and Gas Directly from Arc RPC
    const publicClient = createPublicClient({
      chain: networkConfig.chain,
      transport: http(networkConfig.rpcUrl, { timeout: 12000 }),
    });

    let walletUsdcBalance = 0n;
    let nativeGasBalance = 0n;

    try {
      [walletUsdcBalance, nativeGasBalance] = await Promise.all([
        publicClient.readContract({
          address: networkConfig.usdcAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [session.address as `0x${string}`],
        }),
        publicClient.getBalance({
          address: session.address as `0x${string}`,
        }),
      ]);
    } catch (rpcErr) {
      console.warn("Could not query wallet balance from Arc RPC:", rpcErr);
    }

    const settings = org.settings[0] || {
      minReserveUsdc: 2_000_000n, // 2.00 USDC
      autoApproveLimitUsdc: 500_000n,
    };

    const minReserveAtomic = usdcAtomic(settings.minReserveUsdc || 0n);
    const freeCashAtomic =
      walletUsdcBalance > minReserveAtomic ? walletUsdcBalance - minReserveAtomic : 0n;

    // 3. LLM Daily Rate Limiting Budget Check
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [globalLlmCount, orgLlmCount] = await withDbTimeout(() =>
      Promise.all([
        db.agentDecision.count({
          where: {
            source: "llm",
            timestamp: { gte: startOfDay },
          },
        }),
        db.agentDecision.count({
          where: {
            orgId: org.id,
            source: "llm",
            timestamp: { gte: startOfDay },
          },
        }),
      ])
    );

    const isBudgetExceeded =
      globalLlmCount >= APP_DAILY_LLM_LIMIT || orgLlmCount >= ORG_DAILY_LLM_LIMIT;

    const budgetNotice = isBudgetExceeded
      ? "Daily AI budget reached; using deterministic business logic."
      : null;

    // 4. Run Analysis For Each Open Invoice
    const recommendations = [];

    for (const inv of invoices) {
      const timing = evaluatePaymentTiming({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalUsdc: inv.totalUsdc,
        dueDate: inv.dueDate,
        earlyPayDiscountPct: inv.earlyPayDiscountPct,
        earlyPayDays: inv.earlyPayDays,
        createdAt: inv.createdAt,
        availableTreasuryUsdc: walletUsdcBalance,
        minReserveUsdc: minReserveAtomic,
        upcomingObligationsUsdc: 0n,
      });

      const { recommendation, modelUsed, inputSnapshotHash } = await runAgentAnalysis({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorName: inv.vendor?.name || "Unknown Supplier",
        amountFormatted: formatUsdc(usdcAtomic(inv.totalUsdc)),
        amountAtomic: inv.totalUsdc.toString(),
        matchStatus: inv.matchStatus,
        duplicateScore: inv.duplicateScore,
        isInjectionSuspect: inv.isInjectionSuspect,
        untrustedRawText: inv.rawContent,
        cashPosition: {
          availableTreasury: formatUsdc(usdcAtomic(walletUsdcBalance)),
          minimumReserve: formatUsdc(usdcAtomic(minReserveAtomic)),
          netFreeCash: formatUsdc(usdcAtomic(freeCashAtomic)),
        },
        obligationsQueue: {
          totalPendingAmount: formatUsdc(usdcAtomic(inv.totalUsdc)),
          itemCount: invoices.length,
        },
      });

      // Refine timing advice if discount capture is advantageous or reserve would be breached
      let finalAction = recommendation.action;
      const combinedReasoning = [...recommendation.reasoning];

      if (timing.choice === "pay_now" && recommendation.action === "pay_now") {
        combinedReasoning.unshift(timing.reasoning);
      } else if (timing.choice === "hold" || timing.choice === "schedule") {
        finalAction = timing.choice;
        combinedReasoning.unshift(timing.reasoning);
      } else if (timing.choice === "escalate") {
        finalAction = "request_review";
        combinedReasoning.unshift(timing.reasoning);
      }

      const source = isBudgetExceeded
        ? "fallback"
        : modelUsed.includes("heuristic") || modelUsed.includes("fallback")
        ? "fallback"
        : "llm";

      const finalModelName = isBudgetExceeded
        ? "deterministic-fallback"
        : modelUsed;

      // Persist AgentDecision row scoped to this organization
      const decisionRow = await withDbTimeout(() =>
        db.agentDecision.create({
          data: {
            orgId: org.id,
            invoiceId: inv.id,
            observationHash: inputSnapshotHash,
            cashPosition: formatUsdc(usdcAtomic(walletUsdcBalance)),
            choice: finalAction,
            reasoning: combinedReasoning.join(" | "),
            source,
            model: finalModelName,
            promptVersion: "v2.0-noncustodial",
            escalated: false,
            outcome: "proposed",
          },
        })
      );

      recommendations.push({
        decisionId: decisionRow.id,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        vendorName: inv.vendor?.name || "Unknown Supplier",
        amountFormatted: formatUsdc(usdcAtomic(inv.totalUsdc)),
        choice: finalAction,
        reasoning: combinedReasoning,
        source,
        modelName: finalModelName,
        timingAction: timing.choice,
        discountOpportunity: timing.discountAvailable
          ? {
              discountCapturedUsdc: timing.discountCapturedUsdc,
            }
          : null,
      });
    }

    return NextResponse.json({
      success: true,
      nonCustodialNotice:
        "The agent never executes automatically for your business. Every payment requires your wallet signature.",
      budgetNotice,
      wallet: {
        address: session.address,
        usdcBalanceFormatted: formatUsdc(usdcAtomic(walletUsdcBalance)),
        nativeGasFormatted: formatUnits(nativeGasBalance, 18),
      },
      stats: {
        analyzedCount: recommendations.length,
        orgDailyLlmUsed: orgLlmCount,
        orgDailyLlmCap: ORG_DAILY_LLM_LIMIT,
        globalDailyLlmUsed: globalLlmCount,
        globalDailyLlmCap: APP_DAILY_LLM_LIMIT,
      },
      recommendations,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute agent analysis" },
      { status: 500 }
    );
  }
}
