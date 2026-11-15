import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeRedirectUrl } from "@/lib/url-security";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protected routes require authenticated user session
  const isProtected =
    pathname.startsWith("/elder") ||
    pathname.startsWith("/caregiver") ||
    pathname.startsWith("/onboarding");

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect already authenticated users away from login/signup
  if ((pathname === "/login" || pathname === "/signup") && user) {
    const role = (user.user_metadata?.role as string) || "elder";
    const rawRedirect = request.nextUrl.searchParams.get("redirectTo");
    const safeRedirect = sanitizeRedirectUrl(rawRedirect);

    const redirectUrl = request.nextUrl.clone();
    if (safeRedirect) {
      redirectUrl.pathname = safeRedirect;
      redirectUrl.search = "";
    } else {
      redirectUrl.pathname = role === "caregiver" ? "/caregiver" : "/elder";
    }
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
