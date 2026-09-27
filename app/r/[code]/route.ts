import { NextResponse, type NextRequest } from "next/server";
import { ATTRIBUTION_DAYS, createReferralClick, isAffiliateTrackingEnabled, isAllowedAffiliate, REFERRAL_COOKIE } from "@/lib/affiliate";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isAllowedAffiliate(code)) return new NextResponse("הקישור לא נמצא", { status: 404 });
  if (!isAffiliateTrackingEnabled() || !hasSupabaseEnv()) {
    return new NextResponse("קישור השותף אינו זמין כרגע", { status: 503 });
  }

  try {
    const client = getSupabaseAdminClient();
    if (!client) throw new Error("Affiliate database unavailable");
    const token = await createReferralClick(client, code);
    if (!token) throw new Error("Affiliate code unavailable");

    const response = NextResponse.redirect(new URL("/register", request.url));
    response.cookies.set(REFERRAL_COOKIE, token, {
      httpOnly: true,
      maxAge: ATTRIBUTION_DAYS * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    console.error("AFFILIATE_CLICK_FAILED", error);
    return new NextResponse("קישור השותף אינו זמין כרגע", { status: 503 });
  }
}
