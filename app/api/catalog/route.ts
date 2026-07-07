import { NextResponse } from "next/server";

import { isAuthorizedSyncRequest } from "@/lib/auth/sync-auth";
import { getFitmentReviewList, getSnapshotMeta } from "@/lib/redis/snapshot";
import { loadCurrentSnapshot } from "@/lib/sync/run-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [meta, snapshot, reviewItems] = await Promise.all([
      getSnapshotMeta(),
      loadCurrentSnapshot(),
      getFitmentReviewList(),
    ]);

    if (!snapshot) {
      return NextResponse.json({
        ok: true,
        snapshot: null,
        meta,
        review_items: reviewItems,
      });
    }

    return NextResponse.json({
      ok: true,
      meta: meta ?? {
        version: snapshot.version,
        synced_at: snapshot.synced_at,
        product_count: snapshot.product_count,
      },
      snapshot,
      review_items: reviewItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown catalog error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
