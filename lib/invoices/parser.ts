import { sha256 } from "@/lib/crypto";

export interface ParsedInvoiceText {
  invoiceNumber?: string;
  poReference?: string;
  totalUsdc?: string;
  remittanceAddress?: string;
  vendorName?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPriceUsdc: string;
    totalUsdc: string;
  }>;
}

/**
 * Extracts invoice metadata and line items from raw text or OCR output.
 */
export function parseInvoiceRawText(rawText: string): ParsedInvoiceText {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  let invoiceNumber: string | undefined;
  let poReference: string | undefined;
  let totalUsdc: string | undefined;
  let remittanceAddress: string | undefined;
  let vendorName: string | undefined;
  const items: ParsedInvoiceText["items"] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Vendor heuristic: first line if doesn't contain colon or keyword
    if (i === 0 && !line.includes(":") && !line.toLowerCase().includes("invoice")) {
      vendorName = line;
    }

    // Invoice #
    const invMatch = line.match(/(?:Invoice\s*(?:#|No|Number)?|INV\s*#?)[:.\s]*([A-Z0-9-_]+)/i);
    if (invMatch && !invoiceNumber) {
      invoiceNumber = invMatch[1].trim();
    }

    // PO Reference
    const poMatch = line.match(/(?:PO\s*(?:#|Ref|Reference)?|Purchase\s*Order)[:.\s]*([A-Z0-9-_]+)/i);
    if (poMatch && !poReference) {
      poReference = poMatch[1].trim();
    }

    // Remittance / Destination Wallet
    const walletMatch = line.match(/(0x[a-fA-F0-9]{40})/i);
    if (walletMatch && !remittanceAddress) {
      remittanceAddress = walletMatch[1].toLowerCase();
    }

    // Total Due / Total USDC
    const totalMatch = line.match(/(?:Total\s*Due|Total|Amount\s*Due|Subtotal)[:.\s]*\$?([0-9,]+(?:\.[0-9]{2})?)/i);
    if (totalMatch) {
      totalUsdc = totalMatch[1].replace(/,/g, "").trim();
    }

    // Line items heuristic: Item: Name, Qty: 200, Price: 8.50
    const itemMatch = line.match(/Item:\s*(.+?)(?:,|\n|$)/i);
    const qtyMatch = line.match(/Quantity:\s*([0-9]+)/i);
    const priceMatch = line.match(/Unit\s*Price:\s*([0-9,]+(?:\.[0-9]{2})?)/i);

    if (itemMatch && qtyMatch && priceMatch) {
      const q = parseInt(qtyMatch[1], 10);
      const p = priceMatch[1].replace(/,/g, "");
      const total = (parseFloat(p) * q).toFixed(2);
      items.push({
        description: itemMatch[1].trim(),
        quantity: q,
        unitPriceUsdc: p,
        totalUsdc: total,
      });
    }
  }

  return {
    invoiceNumber,
    poReference,
    totalUsdc,
    remittanceAddress,
    vendorName,
    items,
  };
}
