import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protected routes — declared once at module scope so the catch block below
// can reuse the same check when getUser() throws. Previously this list was
// duplicated inside the try block, which meant an auth error silently passed
// protected requests through (SEC-001 fail-open).
const PROTECTED_PATHS = [
  "/dashboard",
  "/pipeline",
  "/leads",
  "/follow-ups",
  "/settings",
  "/api/leads",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((path) => pathname.startsWith(path));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Fail-closed: when Supabase is not configured, block protected routes
    // instead of silently passing them through without authentication.
    if (isProtectedPath(request.nextUrl.pathname)) {
      return new NextResponse("Authentication service unavailable", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Protected routes
    const isProtected = isProtectedPath(request.nextUrl.pathname);

    if (isProtected && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      // GHSA-3g8h-86w9-wvmq interim mitigation: never let any intermediary
      // cache an auth-gate redirect (cache-poisoning class, fixed in Next 16).
      const res = NextResponse.redirect(url);
      res.headers.set("Cache-Control", "no-store, max-age=0");
      return res;
    }

    // Redirect logged-in users away from auth pages
    const authPaths = ["/login", "/signup"];
    const isAuth = authPaths.some((path) =>
      request.nextUrl.pathname.startsWith(path)
    );

    if (isAuth && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const res = NextResponse.redirect(url);
      res.headers.set("Cache-Control", "no-store, max-age=0");
      return res;
    }
  } catch (error) {
    console.error("Middleware auth error:", error instanceof Error ? error.message : "Unknown error");
    // Fail-closed (SEC-001): if getUser() throws (malformed cookie, transient
    // Supabase 5xx, network blip, JWKS fetch failure) we must NOT let the
    // request fall through to a protected route handler unauthenticated.
    // Public pages (login, signup, landing) still render so users can
    // recover. Protected routes get a 503 so the user sees a clear error
    // instead of silently bypassing the gate.
    if (isProtectedPath(request.nextUrl.pathname)) {
      return new NextResponse("Authentication service temporarily unavailable", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }

  return supabaseResponse;
}
