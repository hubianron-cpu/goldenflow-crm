import { NextResponse, type NextRequest } from "next/server";
import { AffiliateRateLimitError, createReferralClick, getActiveReferralClick, isAffiliateTrackingEnabled, isAllowedAffiliate, REFERRAL_COOKIE } from "@/lib/affiliate";
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
    const existingToken = request.cookies.get(REFERRAL_COOKIE)?.value;
    const referral = await getActiveReferralClick(client, existingToken, code) ?? await createReferralClick(client, code);
    if (!referral) throw new Error("Affiliate code unavailable");

    const response = NextResponse.redirect(new URL("/register", request.url));
    response.cookies.set(REFERRAL_COOKIE, referral.token, {
      httpOnly: true,
      expires: referral.expiresAt,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    if (error instanceof AffiliateRateLimitError) {
      return new NextResponse("יותר מדי בקשות לקישור השותף. נסו שוב מאוחר יותר.", {
        status: 429,
        headers: { "Retry-After": "60", "Cache-Control": "no-store" },
      });
    }
    console.error("AFFILIATE_CLICK_FAILED");
    return new NextResponse("קישור השותף אינו זמין כרגע", { status: 503 });
  }
}
