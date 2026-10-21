import { NextResponse } from "next/server";

export interface DatabaseErrorMapping {
  message: string;
  statusCode: number;
}

/**
 * Maps raw database and Prisma errors to short, safe, user-friendly messages.
 * Detailed technical errors, stack traces, and internal query schemas are logged
 * server-side only. NEVER returns raw Prisma or database invocation text to client.
 */
export function formatDatabaseError(err: any): DatabaseErrorMapping {
  // Always log full error details server-side
  if (process.env.NODE_ENV !== "test" || process.env.DEBUG === "true") {
    console.error("[DATABASE_SERVER_ERROR]:", err);
  }

  if (!err) {
    return {
      message: "An unexpected error occurred. Please try again.",
      statusCode: 500,
    };
  }

  const code = String(err.code || err.name || "");
  const messageStr = String(err.message || "");

  // P2003: Foreign key constraint violation
  if (
    code === "P2003" ||
    messageStr.includes("P2003") ||
    messageStr.toLowerCase().includes("foreign key") ||
    messageStr.toLowerCase().includes("fkey")
  ) {
    return {
      message: "Could not save: the order line no longer exists. Refresh and try again.",
      statusCode: 400,
    };
  }

  // P2002: Unique constraint failed
  if (
    code === "P2002" ||
    messageStr.includes("P2002") ||
    messageStr.toLowerCase().includes("unique constraint")
  ) {
    return {
      message: "Could not save: A record with this identifier already exists in your organization.",
      statusCode: 409,
    };
  }

  // P2025: Record to update/delete not found
  if (
    code === "P2025" ||
    messageStr.includes("P2025") ||
    messageStr.toLowerCase().includes("record to update not found") ||
    messageStr.toLowerCase().includes("record to delete does not exist")
  ) {
    return {
      message: "The requested record could not be found or has already been modified. Refresh and try again.",
      statusCode: 404,
    };
  }

  // P2000: Value too long for column
  if (code === "P2000" || messageStr.includes("P2000")) {
    return {
      message: "Could not save: One or more fields exceed the maximum permitted length.",
      statusCode: 400,
    };
  }

  // P2024: Connection pool timeout
  if (
    code === "P2024" ||
    messageStr.includes("P2024") ||
    messageStr.toLowerCase().includes("timed out")
  ) {
    return {
      message: "Database busy: Query timed out. Please retry in a few moments.",
      statusCode: 503,
    };
  }

  // Defense-in-depth: if message contains any internal database / prisma markers
  if (
    messageStr.toLowerCase().includes("prisma") ||
    messageStr.toLowerCase().includes("invocation") ||
    messageStr.toLowerCase().includes("relation") ||
    messageStr.toLowerCase().includes("syntax error") ||
    messageStr.toLowerCase().includes("connection") ||
    messageStr.toLowerCase().includes("query") ||
    messageStr.toLowerCase().includes("schema")
  ) {
    return {
      message: "Database operation failed. Please verify your input and try again.",
      statusCode: 500,
    };
  }

  return {
    message: sanitizeErrorMessage(err.message || "An unexpected database error occurred."),
    statusCode: 500,
  };
}

/**
 * Sanitizes any string to ensure neither "prisma" nor "invocation"
 * ever leak to the client under any circumstance.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return "An unexpected error occurred.";
  const lower = message.toLowerCase();
  if (lower.includes("prisma") || lower.includes("invocation")) {
    return "Database operation failed. Please verify your input and try again.";
  }
  return message;
}

export function safeDbErrorResponse(
  error: any,
  fallbackStatusOrContext: number | string = 500
): NextResponse {
  const fallbackStatus =
    typeof fallbackStatusOrContext === "number" ? fallbackStatusOrContext : 500;
  if (typeof fallbackStatusOrContext === "string" && process.env.NODE_ENV !== "test") {
    console.error(`[DATABASE_ERROR] ${fallbackStatusOrContext}:`, error);
  }
  const { message, statusCode } = formatDatabaseError(error);
  return NextResponse.json(
    { error: message },
    { status: statusCode || fallbackStatus }
  );
}
