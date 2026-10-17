import { describe, it, expect } from "vitest";
import { formatDatabaseError, safeDbErrorResponse, sanitizeErrorMessage } from "@/lib/errors";
import { Prisma } from "@prisma/client";

describe("Database Error Protection & Sanitization Suite", () => {
  it("maps Prisma P2003 foreign key constraint errors to safe order line message without leaking prisma/invocation", () => {
    const rawP2003Error = {
      code: "P2003",
      message:
        "Invalid `prisma.goodsReceipt.create()` invocation:\nForeign key constraint violated: `GRLine_itemId_fkey`",
    };

    const formatted = formatDatabaseError(rawP2003Error);
    expect(formatted.statusCode).toBe(400);
    expect(formatted.message).toBe("Could not save: the order line no longer exists. Refresh and try again.");
    expect(formatted.message.toLowerCase()).not.toContain("prisma");
    expect(formatted.message.toLowerCase()).not.toContain("invocation");
  });

  it("maps Prisma P2002 unique constraint errors to a clean user message", () => {
    const rawP2002Error = {
      code: "P2002",
      message:
        "Invalid `prisma.purchaseOrder.create()` invocation:\nUnique constraint failed on the fields: (`poNumber`)",
    };

    const formatted = formatDatabaseError(rawP2002Error);
    expect(formatted.statusCode).toBe(409);
    expect(formatted.message).toContain("already exists");
    expect(formatted.message.toLowerCase()).not.toContain("prisma");
    expect(formatted.message.toLowerCase()).not.toContain("invocation");
  });

  it("maps Prisma P2025 record not found errors to a clean user message", () => {
    const rawP2025Error = {
      code: "P2025",
      message:
        "Invalid `prisma.invoice.update()` invocation:\nAn operation failed because it depends on one or more records that were required but not found. Record to update not found.",
    };

    const formatted = formatDatabaseError(rawP2025Error);
    expect(formatted.statusCode).toBe(404);
    expect(formatted.message).toContain("could not be found");
    expect(formatted.message.toLowerCase()).not.toContain("prisma");
    expect(formatted.message.toLowerCase()).not.toContain("invocation");
  });

  it("sanitizes arbitrary internal database errors containing prisma or invocation", () => {
    const arbitraryErrors = [
      new Error("Invalid `prisma.queryRaw()` invocation: syntax error at or near 'SELECT'"),
      new Error("Raw invocation failed in prisma runtime"),
      new Error("PrismaClientKnownRequestError: relation does not exist"),
      { message: "prisma engine failed invocation on database cluster" },
    ];

    for (const err of arbitraryErrors) {
      const formatted = formatDatabaseError(err);
      expect(formatted.message.toLowerCase()).not.toContain("prisma");
      expect(formatted.message.toLowerCase()).not.toContain("invocation");
    }
  });

  it("verifies safeDbErrorResponse produces a JSON body strictly devoid of prisma or invocation", async () => {
    const syntheticPrismaError = {
      code: "P2003",
      message: "Invalid `prisma.goodsReceipt.create()` invocation: Foreign key constraint violated: GRLine_itemId_fkey",
    };

    const response = safeDbErrorResponse(syntheticPrismaError);
    const body = await response.json();
    const serialized = JSON.stringify(body).toLowerCase();

    expect(response.status).toBe(400);
    expect(serialized).not.toContain("prisma");
    expect(serialized).not.toContain("invocation");
    expect(body.error).toBe("Could not save: the order line no longer exists. Refresh and try again.");
  });

  it("verifies sanitizeErrorMessage catches any stray prisma or invocation string", () => {
    expect(sanitizeErrorMessage("Error: prisma query failed")).toBe(
      "Database operation failed. Please verify your input and try again."
    );
    expect(sanitizeErrorMessage("Unknown invocation in database client")).toBe(
      "Database operation failed. Please verify your input and try again."
    );
    expect(sanitizeErrorMessage("Clean business rule validation failure")).toBe(
      "Clean business rule validation failure"
    );
  });
});
