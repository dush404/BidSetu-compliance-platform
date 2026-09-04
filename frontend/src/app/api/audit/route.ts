import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapAuditEntry } from "@/lib/verification";
import { getStrapiAuditLogs } from "@/lib/strapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const strapiAudits = await getStrapiAuditLogs();
    if (strapiAudits && strapiAudits.length > 0) {
      return NextResponse.json({ entries: strapiAudits });
    }
  } catch (err) {
    console.warn("[audit] Failed to fetch from Strapi, falling back to local DB:", err);
  }

  const rows = await db.auditEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return NextResponse.json({ entries: rows.map(mapAuditEntry) });
}
