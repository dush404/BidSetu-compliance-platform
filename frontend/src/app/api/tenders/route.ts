import { NextRequest, NextResponse } from "next/server";
import { getStrapiTenders } from "@/lib/strapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const tenders = await getStrapiTenders(q);
    return NextResponse.json({ tenders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load tenders from Strapi." },
      { status: 502 }
    );
  }
}
