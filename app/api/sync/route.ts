import { NextResponse } from "next/server";

import { isAuthorizedSyncRequest } from "@/lib/auth/sync-auth";
import { runProductSync } from "@/lib/sync/run-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function serializeSyncError(error: unknown): {
  message: string;
  name: string | null;
  stack: string | null;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ?? null,
    };
  }

  return {
    message: String(error),
    name: null,
    stack: null,
  };
}

async function handleSync(request: Request) {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[api/sync] Starting product sync");
    const result = await runProductSync();
    console.log("[api/sync] Sync completed", {
      product_count: result.product_count,
      parse_failures: result.parse_failures,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const details = serializeSyncError(error);

    console.error("[api/sync] Sync failed:", details.message);
    console.error(error);
    if (details.stack) {
      console.error(details.stack);
    }

    return NextResponse.json(
      {
        ok: false,
        error: details.message,
        error_name: details.name,
        stack: details.stack,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}
