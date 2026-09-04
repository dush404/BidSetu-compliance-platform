import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  GOV_COLLECTIONS,
  loadGovRecords,
  matchBlacklistRecords,
  strapiItem,
  strapiResponse,
} from "@/lib/strapi-adapter";

/**
 * Route factory for the simulated government registries.
 * Serves the exact query dialect strapi_client.py uses:
 *   GET /api/<collection>?filters[<key>][$eq]=<value>
 * For blacklist-databases it also handles the $or filter groups.
 */
export function handleGovCollection(collection: string) {
  return async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;

    if (collection === "blacklist-databases") {
      const rows = await loadGovRecords(collection);
      const matched = matchBlacklistRecords(
        params,
        rows.map((r) => ({ data: r.data as Record<string, unknown>, __id: r.id }))
      );
      return NextResponse.json(
        strapiResponse(
          matched.map((m) =>
            strapiItem((m as { __id: string }).__id, m.data as Record<string, unknown>)
          )
        )
      );
    }

    const filterKey = GOV_COLLECTIONS[collection];
    const filterValue = params.get(`filters[${filterKey}][$eq]`);

    if (!filterValue) {
      // No filter — return the whole collection.
      const rows = await loadGovRecords(collection);
      return NextResponse.json(
        strapiResponse(rows.map((r) => strapiItem(r.id, r.data as Record<string, unknown>)))
      );
    }

    const rec = await db.govRecord.findUnique({
      where: {
        collection_filterKey_filterValue: { collection, filterKey, filterValue },
      },
    });
    return NextResponse.json(
      strapiResponse(rec ? [strapiItem(rec.id, rec.data as Record<string, unknown>)] : [])
    );
  };
}
