import { NextResponse } from "next/server";
import { getStrapiBidder } from "@/lib/strapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const bidder = await getStrapiBidder(id);
    if (!bidder) {
      return NextResponse.json({ error: "Bidder not found." }, { status: 404 });
    }
    return NextResponse.json({ bidder });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load bidder from Strapi.",
      },
      { status: 502 }
    );
  }
}
