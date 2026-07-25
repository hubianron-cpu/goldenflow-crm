import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv } from "@/lib/env";
import { getSubscriptionAccess } from "@/lib/subscriptions";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/lead") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

function redirectToLogin(request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";

  const redirectResponse = NextResponse.redirect(url);

  request.cookies.getAll().forEach((cookie) => {
    if (cookie.name.startsWith("sb-")) {
      redirectResponse.cookies.delete(cookie.name);
      response.cookies.delete(cookie.name);
    }
  });

  return redirectResponse;
}

function redirectToUpgrade(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/upgrade";
  url.search = "";
  return NextResponse.redirect(url);
}

function shouldCheckSubscription(pathname: string) {
  return !pathname.startsWith("/admin");
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  if (!hasSupabaseEnv() || isPublicPath(request.nextUrl.pathname)) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return redirectToLogin(request, response);
    }

    if (shouldCheckSubscription(request.nextUrl.pathname)) {
      const { data: subscription, error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .select("user_id,status,plan_name,trial_start_at,trial_end_at,upgraded_at,created_at,updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (subscriptionError) {
        console.error("SUBSCRIPTION_MIDDLEWARE_CHECK_FAILED", {
          code: subscriptionError.code ?? null,
          message: subscriptionError.message ?? null,
        });
      }

      if (!getSubscriptionAccess(subscription).hasAccess) {
        return redirectToUpgrade(request);
      }
    }
  } catch {
    return redirectToLogin(request, response);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/leads/:path*", "/tasks/:path*", "/pipeline/:path*", "/roi-center", "/roi-center/:path*", "/business-center", "/business-center/:path*", "/admin/:path*"],
};
