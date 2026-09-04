import { handleGovCollection } from "@/lib/gov-collection-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Strapi-compatible endpoint consumed by strapi_client.py (AI worker).
export const GET = handleGovCollection("gst-databases");
