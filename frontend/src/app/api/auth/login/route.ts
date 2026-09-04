import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = typeof body?.role === "string" ? body.role : "";

  if (!email || !password || !role) {
    return NextResponse.json(
      { ok: false, error: "Email, password and role are required." },
      { status: 400 }
    );
  }

  const isDeveloper = role === "DEVELOPER";
  const user: SessionUser = {
    name: isDeveloper ? "Developer" : "Procurement Officer",
    email,
    role: isDeveloper ? "DEVELOPER" : "OFFICER",
    department: isDeveloper ? "Platform Engineering" : "Dept. of Procurement",
    location: isDeveloper ? "Bengaluru, India" : "New Delhi, India",
  };

  await db.auditEntry.create({
    data: {
      action: "SESSION",
      message: isDeveloper ? "Developer signed in" : "Officer signed in",
      officer: user.name,
    },
  });

  const res = NextResponse.json({ ok: true, user });
  res.cookies.set("atc_role", user.role, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
