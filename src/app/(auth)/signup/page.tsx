"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getOAuthRedirectTo } from "@/lib/auth";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { CaptchaStatusPill } from "@/components/auth/captcha-status-pill";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const GENERIC_SIGNUP_ERROR = "Something went wrong. Please try again.";

/**
 * Maps Supabase OTP errors to user-appropriate copy. Rate-limit messages are
 * rewritten to set expectations; everything else passes through the real
 * message (it is already safe, user-facing text from Supabase), with the
 * generic string as last resort.
 */
function humanizeSignupError(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  if (!message) return GENERIC_SIGNUP_ERROR;
  if (/rate limit/i.test(message)) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (/invalid.*email/i.test(message)) {
    return "Please enter a valid email address.";
  }
  return message;
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false);
  const captchaDisabled =
    process.env.NEXT_PUBLIC_TURNSTILE_DISABLED === "true";
  const captchaVerified = captchaDisabled || captchaToken !== "";

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: getOAuthRedirectTo(),
        captchaToken,
      },
    });

    if (error) {
      setErrorMessage(humanizeSignupError({ message: error.message }));
    } else {
      setSuccessMessage("Check your email for the login link!");
    }
    setLoading(false);
  };

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-[26px] font-semibold text-surface-900 tracking-[-0.02em] leading-[1.2]">
          Create your account
        </h1>
        <p className="text-[15px] text-surface-500 mt-1.5">
          Start managing leads today
        </p>
      </div>

      <OAuthButtons onError={setErrorMessage} />

      <div className="flex items-center my-5" aria-hidden="true">
        <div className="flex-1 h-px bg-surface-200" />
        <span className="text-[12px] text-surface-500 uppercase tracking-wider px-3">
          or
        </span>
        <div className="flex-1 h-px bg-surface-200" />
      </div>

      <form onSubmit={handleSignup} className="relative">
        <div className="mb-3">
          <label
            htmlFor="fullName"
            className="block text-[14px] font-medium text-surface-700 mb-1.5"
          >
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            autoComplete="name"
            required
            className="input-field"
          />
        </div>

        <div className="mb-3">
          <label
            htmlFor="signup-email"
            className="block text-[14px] font-medium text-surface-700 mb-1.5"
          >
            Email address
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            maxLength={254}
            className="input-field"
          />
        </div>

        {!captchaDisabled && (
          <div
            className="absolute -left-[9999px] -top-[9999px] w-px h-px overflow-hidden pointer-events-none"
            aria-hidden="true"
            // `inert` prevents keyboard focus from entering the off-screen widget,
            // which otherwise trips the aria-hidden-focus a11y rule.
            inert
          >
            <TurnstileWidget
              onLoad={() => setCaptchaReady(true)}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken("")}
              onError={() => setCaptchaToken("")}
            />
          </div>
        )}

        {!captchaDisabled && (
          <CaptchaStatusPill
            captchaVerified={captchaVerified}
            captchaReady={captchaReady}
          />
        )}

        <Button
          type="submit"
          variant="cta"
          size="lg"
          loading={loading}
          disabled={!captchaVerified}
          aria-describedby="captcha-status"
          className="w-full mt-3"
        >
          {!loading && <Mail className="h-4 w-4 mr-2" />}
          Send magic link
        </Button>
      </form>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 p-3 rounded-lg bg-destructive-50 text-destructive text-sm text-center border border-destructive-100"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mt-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm text-center border border-success-100"
        >
          {successMessage}
        </div>
      )}

      <p className="text-center text-[14px] text-surface-500 mt-8">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary hover:text-primary-700 font-medium"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
