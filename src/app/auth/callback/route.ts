import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/resend";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? searchParams.get("redirect") ?? "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    console.error("[auth/callback] OAuth provider error:", error, errorDescription);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (!exchangeError) {
        // Fire-and-forget: send welcome email to new users (profile created in last 5 min)
        if (data.user) {
          const userId = data.user.id;
          const userEmail = data.user.email;
          const userCreated = new Date(data.user.created_at);
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

          if (userEmail && userCreated > fiveMinAgo) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", userId)
              .single();

            const name = profile?.full_name || userEmail.split("@")[0];
            sendWelcomeEmail(userEmail, name).catch((err) =>
              console.error("[auth/callback] Welcome email failed:", err)
            );
          }
        }

        // Validate redirect: must be a same-origin absolute path (prevent open redirect)
        let redirectPath = "/";
        try {
          // Resolve `next` against origin to catch relative and absolute URLs
          const resolved = new URL(next, origin);
          // Only allow same-origin redirects with a path-only value
          if (resolved.origin === origin && resolved.pathname.startsWith("/")) {
            redirectPath = resolved.pathname + resolved.search;
          }
        } catch {
          // Invalid URL — fall back to root
        }
        return NextResponse.redirect(`${origin}${redirectPath}`);
      }
      // Log the message only. A Supabase error object can carry a response
      // body, and the callback URL holds the auth code — neither belongs in a log.
      console.error("[auth/callback] Exchange failed:", exchangeError.message);
    } catch (err) {
      console.error(
        "[auth/callback] Exception during exchange:",
        err instanceof Error ? err.message : "Unknown error"
      );
    }
  } else {
    console.error("[auth/callback] No code parameter in callback URL");
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
