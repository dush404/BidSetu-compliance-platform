import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  const relativePath = segments.join("/");
  const fileName = segments[segments.length - 1];
  const candidateMime = getMimeType(fileName);

  // 1. Try proxying to Strapi service
  const candidateUrls = [
    process.env.STRAPI_URL,
    "http://strapi:1337",
    "http://localhost:1337",
    "http://127.0.0.1:1337",
  ].filter(Boolean) as string[];

  for (const baseUrl of candidateUrls) {
    try {
      const strapiTarget = `${baseUrl.replace(/\/$/, "")}/uploads/${relativePath}`;
      const res = await fetch(strapiTarget, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || candidateMime;

        return new Response(buffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    } catch {
      continue;
    }
  }

  // 2. Fallback: check local disk paths
  const localCandidates = [
    path.join(process.cwd(), "public", "uploads", relativePath),
    path.join(process.cwd(), "..", "backend", "public", "uploads", relativePath),
    path.join(process.cwd(), "..", "backend", "public", "uploads", fileName),
  ];

  for (const localPath of localCandidates) {
    try {
      if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
        const fileData = fs.readFileSync(localPath);
        return new Response(fileData, {
          status: 200,
          headers: {
            "Content-Type": candidateMime,
            "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
