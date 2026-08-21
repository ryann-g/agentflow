"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";

const MIN_PASSWORD_LENGTH = 6; // Supabase default minimum

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  // The recovery email lands here with ?code=<pkce_code>. Exchange it for a
  // session before rendering the form. If the code is missing/invalid/expired
  // the user gets an actionable error with a path back to /login.
  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const supabase = createClient();
      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && error) {
          setFormError(
            "This password reset link is invalid or has expired. Please request a new one."
          );
          setCheckingSession(false);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setFormError(
          "This password reset link is invalid or has expired. Please request a new one."
        );
      }
      setHasSession(!!session);
      setCheckingSession(false);
    }

    establishSession();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  function validate(): boolean {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return false;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return false;
    }
    setPasswordError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSubmitting(true);
    const { error } = await createClient().auth.updateUser({ password });

    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    setSucceeded(true);
    setSubmitting(false);
    // Session cookies are already set — send the user straight into the app.
    router.push("/dashboard");
  }

  if (checkingSession) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-3 py-12 text-surface-500"
      >
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <p className="text-[14px]">Verifying your reset link…</p>
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-success-50 border border-success-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-7 h-7 text-success" aria-hidden="true" />
        </div>
        <h1 className="text-[26px] font-semibold text-surface-900 tracking-[-0.02em] leading-[1.2] mb-2">
          Password updated
        </h1>
        <p className="text-[15px] text-surface-500 leading-[1.6] mb-7 max-w-[320px] mx-auto">
          Your password has been changed. Use it to sign in from now on.
        </p>
        <Link href="/login">
          <Button variant="cta" size="lg" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="text-center">
        <div
          role="alert"
          className="flex items-start gap-2 bg-destructive-50 border border-destructive-100 rounded-lg p-3 mb-5 text-left"
        >
          <AlertCircle
            className="w-4 h-4 text-destructive mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span className="text-[14px] text-destructive leading-[1.4]">
            {formError}
          </span>
        </div>
        <Link
          href="/login"
          className="text-[14px] text-primary font-medium hover:underline"
        >
          &larr; Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-[26px] font-semibold text-surface-900 tracking-[-0.02em] leading-[1.2] mb-1.5">
          Set a new password
        </h1>
        <p className="text-[15px] text-surface-500 mt-1.5">
          Choose a strong password for your account.
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-destructive-50 border border-destructive-100 rounded-lg p-3 mb-3"
        >
          <AlertCircle
            className="w-4 h-4 text-destructive mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span className="text-[14px] text-destructive leading-[1.4]">
            {formError}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label
            htmlFor="new-password"
            className="block text-[14px] font-medium text-surface-700 mb-1.5"
          >
            New password{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError("");
              }}
              placeholder="At least 6 characters"
              required
              aria-required="true"
              autoComplete="new-password"
              aria-describedby={
                passwordError ? "new-password-error" : undefined
              }
              aria-invalid={!!passwordError}
              className={`input-field pr-10 ${
                passwordError ? "input-error" : ""
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-700 cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="mb-3">
          <label
            htmlFor="confirm-password"
            className="block text-[14px] font-medium text-surface-700 mb-1.5"
          >
            Confirm new password{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (passwordError) setPasswordError("");
            }}
            placeholder="Re-enter your new password"
            required
            aria-required="true"
            autoComplete="new-password"
            aria-describedby={
              passwordError ? "new-password-error" : undefined
            }
            aria-invalid={!!passwordError}
            className={`input-field ${passwordError ? "input-error" : ""}`}
          />
        </div>

        {passwordError && (
          <p
            id="new-password-error"
            role="alert"
            className="flex items-center gap-1 mt-1 mb-2 text-[13px] text-destructive"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {passwordError}
          </p>
        )}

        <Button
          type="submit"
          variant="cta"
          size="lg"
          loading={submitting}
          className="w-full mt-3"
        >
          {!submitting && <Lock className="h-4 w-4 mr-2" aria-hidden="true" />}
          Update password
        </Button>
      </form>

      <p className="text-center text-[14px] text-surface-500 mt-8">
        Remembered it?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-3 py-12 text-surface-500"
        >
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <p className="text-[14px]">Loading…</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
