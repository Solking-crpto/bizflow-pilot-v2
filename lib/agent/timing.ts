import { formatUsdc, usdcAtomic } from "../money";

export interface TimingAnalysisInput {
  invoiceId: string;
  invoiceNumber: string;
  totalUsdc: bigint; // atomic units (6 decimals)
  dueDate: Date | null;
  earlyPayDiscountPct: number | null; // e.g. 2.0 = 2%
  earlyPayDays: number | null; // e.g. 10 days
  createdAt: Date;
  availableTreasuryUsdc: bigint;
  minReserveUsdc: bigint;
  upcomingObligationsUsdc: bigint;
  now?: Date;
}

export interface TimingRecommendation {
  choice: "pay_now" | "schedule" | "hold" | "escalate";
  reasoning: string;
  discountCapturedUsdc?: number;
  discountAvailable: boolean;
  scheduledDate?: Date | null;
  netReserveAfterPaymentUsdc: bigint;
}

/**
 * Analyzes dynamic payment timing: compares cash reserves, liquidity buffers,
 * and upcoming obligations against early-payment discounts and due dates.
 */
export function evaluatePaymentTiming(input: TimingAnalysisInput): TimingRecommendation {
  const now = input.now || new Date();
  const totalUsdcFormatted = formatUsdc(usdcAtomic(input.totalUsdc));
  const minReserveFormatted = formatUsdc(usdcAtomic(input.minReserveUsdc));

  // 1. Check for Early Pay Discount
  const hasDiscount = !!(
    input.earlyPayDiscountPct &&
    input.earlyPayDiscountPct > 0 &&
    input.earlyPayDays &&
    input.earlyPayDays > 0
  );

  if (hasDiscount) {
    const discountPct = input.earlyPayDiscountPct!;
    const discountDays = input.earlyPayDays!;
    const discountDeadline = new Date(input.createdAt.getTime() + discountDays * 86400 * 1000);

    const isDiscountActive = now.getTime() <= discountDeadline.getTime();

    if (isDiscountActive) {
      const discountRatio = discountPct / 100;
      const discountSavingsUsdc = (Number(input.totalUsdc) / 1e6) * discountRatio;
      const netPaymentAtomic = input.totalUsdc - BigInt(Math.round(Number(input.totalUsdc) * discountRatio));
      const postPaymentReserve = input.availableTreasuryUsdc - netPaymentAtomic;

      // Check if cash reserve stays above minimum reserve
      if (postPaymentReserve >= input.minReserveUsdc) {
        return {
          choice: "pay_now",
          discountAvailable: true,
          discountCapturedUsdc: Number(discountSavingsUsdc.toFixed(2)),
          scheduledDate: null,
          netReserveAfterPaymentUsdc: postPaymentReserve,
          reasoning: `Pay now to capture ${discountPct}% early pay discount (${discountSavingsUsdc.toFixed(
            2
          )} USDC saved). Liquidity buffer (${formatUsdc(
            usdcAtomic(postPaymentReserve)
          )}) safely exceeds the mandatory ${minReserveFormatted} operating reserve.`,
        };
      } else {
        // Reserve buffer would be breached
        const targetDate = input.dueDate || new Date(now.getTime() + 7 * 86400 * 1000);
        return {
          choice: "schedule",
          discountAvailable: true,
          discountCapturedUsdc: 0,
          scheduledDate: targetDate,
          netReserveAfterPaymentUsdc: postPaymentReserve,
          reasoning: `Hold payment until ${targetDate.toISOString().slice(0, 10)}: Capturing ${discountPct}% discount would deplete treasury buffer (${formatUsdc(
            usdcAtomic(postPaymentReserve)
          )}) below the ${minReserveFormatted} minimum operating reserve.`,
        };
      }
    }
  }

  // 2. Standard Due Date Evaluation
  const postPaymentReserve = input.availableTreasuryUsdc - input.totalUsdc;

  if (input.dueDate) {
    const msUntilDue = input.dueDate.getTime() - now.getTime();
    const daysUntilDue = Math.floor(msUntilDue / (86400 * 1000));

    if (daysUntilDue > 3) {
      // Schedule payment 2 days before due date
      const scheduledDate = new Date(input.dueDate.getTime() - 2 * 86400 * 1000);
      return {
        choice: "schedule",
        discountAvailable: false,
        scheduledDate,
        netReserveAfterPaymentUsdc: postPaymentReserve,
        reasoning: `Scheduled for payment on ${scheduledDate.toISOString().slice(0, 10)} (${daysUntilDue} days before due date). Optimizes treasury float while preserving vendor terms.`,
      };
    } else {
      // Due within 3 days or overdue
      if (postPaymentReserve >= input.minReserveUsdc) {
        return {
          choice: "pay_now",
          discountAvailable: false,
          scheduledDate: null,
          netReserveAfterPaymentUsdc: postPaymentReserve,
          reasoning: `Due date approaching (${input.dueDate.toISOString().slice(0, 10)}). Cash position (${formatUsdc(
            usdcAtomic(postPaymentReserve)
          )}) complies with liquidity buffer guidelines.`,
        };
      } else {
        return {
          choice: "escalate",
          discountAvailable: false,
          scheduledDate: null,
          netReserveAfterPaymentUsdc: postPaymentReserve,
          reasoning: `Invoice ${input.invoiceNumber} due on ${input.dueDate.toISOString().slice(0, 10)}, but payment would reduce reserve buffer below ${minReserveFormatted} threshold. Escalating to finance officer.`,
        };
      }
    }
  }

  // 3. No due date specified
  if (postPaymentReserve >= input.minReserveUsdc) {
    return {
      choice: "pay_now",
      discountAvailable: false,
      scheduledDate: null,
      netReserveAfterPaymentUsdc: postPaymentReserve,
      reasoning: `Standard payment: Treasury liquidity buffer preserves required reserve floor (${minReserveFormatted}).`,
    };
  } else {
    return {
      choice: "hold",
      discountAvailable: false,
      scheduledDate: null,
      netReserveAfterPaymentUsdc: postPaymentReserve,
      reasoning: `Hold: Liquidity buffer insufficient to support ${totalUsdcFormatted} settlement without violating minimum operating reserve.`,
    };
  }
}
