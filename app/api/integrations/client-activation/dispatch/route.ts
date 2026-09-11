import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reconcileAndDispatchDealWon } from "@/lib/integrations/client-activation";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.CLIENT_ACTIVATION_DISPATCH_SECRET?.trim() || "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || !token || !safeEqual(secret, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await reconcileAndDispatchDealWon();
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
