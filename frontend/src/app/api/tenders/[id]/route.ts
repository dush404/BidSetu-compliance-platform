import { NextResponse } from "next/server";
import { getStrapiTender } from "@/lib/strapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const tender = await getStrapiTender(id);
    if (!tender) {
      return NextResponse.json({ error: "Tender not found." }, { status: 404 });
    }
    return NextResponse.json({ tender });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load tender from Strapi.",
      },
      { status: 502 }
    );
  }
}
