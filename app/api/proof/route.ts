import { NextRequest, NextResponse } from "next/server";
import { withDbTimeout } from "@/lib/db";
import { formatUsdc, usdcAtomic } from "@/lib/money";
import { NETWORKS } from "@/lib/networks";
import { validateApiNetwork } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const apiCheck = validateApiNetwork(req);
    if (apiCheck.errorResponse) return apiCheck.errorResponse;
    const { network: networkMode, db } = apiCheck;

    const network = NETWORKS[networkMode];
    const explorerBase = network.explorerUrl;

    const payment = await withDbTimeout(() =>
      db.payment.findFirst({
        where: {
          status: "confirmed",
        },
        select: {
          id: true,
          status: true,
          txHash: true,
          anchorTxHash: true,
          destination: true,
          amountAtomic: true,
          confirmedAt: true,
          initiatedAt: true,
          vendor: {
            select: {
              name: true,
              walletAddress: true,
            },
          },
          invoice: {
            select: {
              invoiceNumber: true,
            },
          },
          anchor: {
            select: {
              anchorTxHash: true,
            },
          },
        },
        orderBy: {
          confirmedAt: "desc",
        },
      })
    );

    if (!payment) {
      return NextResponse.json(
        {
          status: "none_recorded",
          message: `No confirmed payments recorded on ${network.name} yet.`,
          network: network.name,
          chainId: network.chainId,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          },
        }
      );
    }

    return formatPaymentResponse(payment, explorerBase, network);
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        message: "Database query failed",
        error: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

function formatPaymentResponse(payment: any, explorerBase: string, network: any) {
  const txHash = payment.txHash || "";
  const anchorTxHash = payment.anchorTxHash || payment.anchor?.anchorTxHash || "";

  return NextResponse.json(
    {
      status: "confirmed",
      id: payment.id,
      invoiceNumber: payment.invoice?.invoiceNumber || "UNKNOWN",
      vendor: payment.vendor?.name || "Unknown Supplier",
      vendorWallet: payment.destination || payment.vendor?.walletAddress || "",
      amountAtomic: payment.amountAtomic.toString(),
      amountFormatted: formatUsdc(usdcAtomic(payment.amountAtomic)),
      timestamp: payment.confirmedAt ? payment.confirmedAt.toISOString() : payment.initiatedAt.toISOString(),
      network: network.mode,
      chainId: network.chainId,
      txHash,
      anchorTxHash,
      explorerLinks: {
        paymentTx: txHash ? `${explorerBase}/tx/${txHash}` : null,
        anchorTx: anchorTxHash ? `${explorerBase}/tx/${anchorTxHash}` : null,
      },
      verifyPassportUrl: `/verify/${network.mode}/${payment.id}`,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
