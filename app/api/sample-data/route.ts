import { NextRequest, NextResponse } from "next/server";
import { withDbTimeout } from "@/lib/db";
import { validateApiNetwork } from "@/lib/api-guard";
import { getSessionFromRequest, getSessionOrg } from "@/lib/auth/session";
import { sha256 } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const netCtx = validateApiNetwork(req);
    if (!netCtx.success) return netCtx.response;
    const { network, db } = netCtx;

    // Strict guard: sample data is strictly prohibited on Mainnet
    if (network === "mainnet") {
      return NextResponse.json(
        { error: "CRITICAL REFUSAL: Sample data cannot be loaded on Arc Mainnet." },
        { status: 403 }
      );
    }

    // Require authenticated session
    const session = getSessionFromRequest(req);
    if (!session || !session.address) {
      return NextResponse.json(
        { error: "Authentication required: Please connect and sign in with your Web3 wallet first." },
        { status: 401 }
      );
    }

    // Resolve or provision user organization scoped to network
    let org = await withDbTimeout(() => getSessionOrg(session, network));

    if (!org) {
      // Auto-provision initial org for this wallet on testnet if not yet onboarded
      org = await withDbTimeout(() =>
        db.organization.create({
          data: {
            name: `Test Business (${session.address.slice(0, 6)}...${session.address.slice(-4)})`,
            walletAddress: session.address,
            country: "US",
            settings: {
              create: {
                requireApprovalAbove: 25000000n, // 25 USDC
                priceToleranceBps: 100, // 1%
                minReserveUsdc: 10000000n, // 10 USDC
                dailyLimitUsdc: 100000000n, // 100 USDC
                agentMode: "assisted",
                autoApproveLimitUsdc: 500000n, // 0.50 USDC
                maxDailyAutonomousUsdc: 1000000n, // 1.00 USDC
              },
            },
          },
          include: { settings: true, members: true },
        })
      );
    }

    const orgId = org.id;

    // 1. Create or find sample vendor
    let vendor = await withDbTimeout(() =>
      db.vendor.findFirst({
        where: { orgId, name: { contains: "[SAMPLE]" } },
      })
    );

    if (!vendor) {
      vendor = await withDbTimeout(() =>
        db.vendor.create({
          data: {
            orgId,
            name: "Atlas Industrial Logistics [SAMPLE]",
            walletAddress: "0x3B5D2009e6c2d05413AB77853158fE3f445A174d",
            perVendorLimitUsdc: 100000000n, // 100 USDC
            status: "active",
          },
        })
      );
    }

    // 2. Create sample Purchase Order
    const poNumber = `PO-SAMPLE-${Date.now().toString().slice(-4)}`;
    const po = await withDbTimeout(() =>
      db.purchaseOrder.create({
        data: {
          orgId,
          vendorId: vendor.id,
          poNumber,
          totalUsdc: 50000n, // 0.05 USDC
          status: "approved",
        },
      })
    );

    // 3. Create sample Goods Receipt
    const grNumber = `GR-SAMPLE-${Date.now().toString().slice(-4)}`;
    await withDbTimeout(() =>
      db.goodsReceipt.create({
        data: {
          orgId,
          purchaseOrderId: po.id,
          grNumber,
          receivedBy: "Test Receiving Agent",
          notes: "Automated testnet sample receiving",
        },
      })
    );

    // 4. Create sample Invoice
    const invoiceNumber = `INV-SAMPLE-${Date.now().toString().slice(-4)}`;
    const invoiceText = `INVOICE #${invoiceNumber} [SAMPLE]\nVendor: Atlas Industrial Logistics [SAMPLE]\nAmount: 0.05 USDC\nPO Reference: ${poNumber}\nTerms: 2% 10 Net 30`;
    const invoiceHash = sha256(invoiceText);

    const invoice = await withDbTimeout(() =>
      db.invoice.create({
        data: {
          orgId,
          vendorId: vendor.id,
          purchaseOrderId: po.id,
          invoiceNumber,
          totalUsdc: 50000n, // 0.05 USDC
          fileHash: invoiceHash,
          rawContent: invoiceText,
          extractedData: JSON.stringify({ amount: "0.05", vendor: vendor.name, po: poNumber }),
          matchStatus: "exact_match",
          duplicateScore: 0,
          isInjectionSuspect: false,
          status: "verified",
          earlyPayDiscountPct: 2.0,
          earlyPayDays: 10,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
    );

    return NextResponse.json({
      success: true,
      message: "Sample procurement dataset created successfully inside your organization.",
      records: {
        vendorName: vendor.name,
        poNumber: po.poNumber,
        grNumber,
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice.id,
        amount: "0.05 USDC",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to generate sample data: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
