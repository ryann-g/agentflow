"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getOAuthRedirectTo } from "@/lib/auth";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { CaptchaStatusPill } from "@/components/auth/captcha-status-pill";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Mail, Loader2, Eye, EyeOff, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed:
    "We couldn\u2019t complete your sign-in. Please try again.",
  access_denied: "Access was denied. Please try a different sign-in method.",
  invalid_credentials: "Invalid email or password.",
  email_not_confirmed:
    "Please confirm your email address before signing in.",
  otp_expired: "Your sign-in link has expired. Please request a new one.",
};

function humanizeAuthError(code: string): string {
  // Supabase sometimes passes raw JSON as the error param
  let message = code;
  try {
    const parsed = JSON.parse(code);
    if (parsed.msg) message = parsed.msg;
  } catch {
    // not JSON — use as-is
  }

  if (message.includes("provider is not enabled")) {
    return "This sign-in method is not available yet. Please try another option.";
  }

  const friendly = AUTH_ERROR_MESSAGES[message];
  const humanized = message.replace(/_/g, " ").toLowerCase();
  return friendly
    ? `${friendly} (${humanized})`
    : `Sign-in failed: ${humanized}`;
}

const COMMON_DOMAINS: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gmail.cmo": "gmail.com",
  "gmail.om": "gmail.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "yahooo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "hotmail.con": "hotmail.com",
  "hotmail.cmo": "hotmail.com",
  "icloud.con": "icloud.com",
};

function suggestCorrection(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1]?.toLowerCase();
  if (domain && COMMON_DOMAINS[domain]) {
    return `${parts[0]}@${COMMON_DOMAINS[domain]}`;
  }
  return null;
}

/* ── Main login component ────────────────────────────────── */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [activeView, setActiveView] = useState<
    "magic-link" | "password" | "forgot-password"
  >("magic-link");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [authError, setAuthError] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState("");

  const [resendCooldown, setResendCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false);
  const captchaDisabled =
    process.env.NEXT_PUBLIC_TURNSTILE_DISABLED === "true";
  const captchaVerified = captchaDisabled || captchaToken !== "";

  const getSupabase = useCallback(() => createClient(), []);

  const isLoading = loadingAction !== null;

  // Read any ?error= param left behind by the OAuth callback route
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setAuthError(humanizeAuthError(errorParam));
    }
  }, [searchParams]);

  // Redirect if already authenticated
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (data.session) {
          router.push("/dashboard");
          return;
        }
      } catch {
        // Show form even on error
      }
    };
    checkSession();
  }, [getSupabase, router]);

  // Focus email input after session check resolves
  useEffect(() => {
    const timer = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [activeView]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  /* ── Validation ── */
  const validateEmail = (
    value: string,
    showSuggestion = false,
  ): boolean => {
    if (!value.trim()) {
      setEmailError("Email address is required");
      setEmailSuggestion("");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError("Please enter a valid email address");
      setEmailSuggestion("");
      return false;
    }
    if (showSuggestion) {
      const correction = suggestCorrection(value);
      if (correction) {
        setEmailSuggestion(correction);
        setEmailError("");
        return true;
      }
    }
    setEmailError("");
    setEmailSuggestion("");
    return true;
  };

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError("Password is required");
      return false;
    }
    setPasswordError("");
    return true;
  };

  /* ── Handlers ── */
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!validateEmail(email, true)) return;
    setLoadingAction("magic-link");

    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: getOAuthRedirectTo(), captchaToken },
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setMagicLinkSent(true);
      setSentEmail(email);
      setResendCooldown(30);
    }
    setLoadingAction(null);
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setPasswordError("");
    if (!validateEmail(email)) return;
    if (!validatePassword(password)) return;
    setLoadingAction("password");

    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });

    if (error) {
      setAuthError("Incorrect email or password. Please try again.");
      setPassword("");
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    } else {
      router.push("/dashboard");
    }
    setLoadingAction(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!validateEmail(email, false)) return;
    setLoadingAction("forgot-password");

    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken,
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setForgotPasswordSent(true);
    }
    setLoadingAction(null);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoadingAction("magic-link");
    const { error } = await getSupabase().auth.signInWithOtp({
      email: sentEmail,
      options: { emailRedirectTo: getOAuthRedirectTo(), captchaToken },
    });
    if (!error) setResendCooldown(30);
    setLoadingAction(null);
  };

  const resetToMagicLink = () => {
    setMagicLinkSent(false);
    setSentEmail("");
    setEmailError("");
    setEmailSuggestion("");
    setAuthError("");
  };

  const resetToLogin = () => {
    setActiveView("magic-link");
    setForgotPasswordSent(false);
    setEmailError("");
    setEmailSuggestion("");
    setAuthError("");
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) setEmailError("");
    if (emailSuggestion) setEmailSuggestion("");
  };

  /* ── Shared input classes ── */
  const inputClasses = (hasError: boolean) =>
    `input-field ${hasError ? "input-error" : ""}`;

  return (
    <>
      {/* ── Header ── */}
      <div className="text-center mb-1.5">
        <h1 className="text-[26px] font-semibold text-surface-900 tracking-[-0.02em] leading-[1.2]">
          {activeView === "forgot-password"
            ? "Reset your password"
            : "Welcome back"}
        </h1>
        <p className="text-[15px] text-surface-500 mt-1.5">
          {activeView === "forgot-password"
            ? "Enter your email and we\u2019ll send you a reset link."
            : "Sign in to your AgentFlow account"}
        </p>
      </div>

      {activeView === "forgot-password" && (
        <button
          type="button"
          onClick={resetToLogin}
          className="text-[14px] text-primary font-medium hover:underline mb-4"
        >
          &larr; Back to sign in
        </button>
      )}

      {/* ── OAuth buttons ── */}
      {activeView !== "forgot-password" && (
        <OAuthButtons onError={setAuthError} />
      )}

      {/* ── "or" divider ── */}
      {activeView !== "forgot-password" && (
        <div className="flex items-center my-5" aria-hidden="true">
          <div className="flex-1 h-px bg-surface-200" />
          <span className="text-[12px] text-surface-500 uppercase tracking-wider px-3">
            or
          </span>
          <div className="flex-1 h-px bg-surface-200" />
        </div>
      )}

      {/* ── Error banner ── */}
      {authError && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-destructive-50 border border-destructive-100 rounded-lg p-3 mb-3"
        >
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <span className="text-[14px] text-destructive leading-[1.4]">
            {authError}
          </span>
        </div>
      )}

      {/* ── Off-screen Turnstile widget ── */}
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

      {/* ── Success states ── */}
      {magicLinkSent ? (
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-success-50 border border-success-100 flex items-center justify-center mx-auto mb-5">
            <Mail className="w-7 h-7 text-success" />
          </div>
          <h2 className="text-2xl font-semibold text-surface-900 mb-2">
            Check your email
          </h2>
          <p className="text-[15px] text-surface-500 leading-[1.6] mb-7 max-w-[320px] mx-auto">
            We sent a magic link to {sentEmail}. Click the link to sign in.
            It expires in 10 minutes.
          </p>
          <p className="text-[14px] text-surface-500">
            Didn&apos;t get it?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isLoading}
              className="text-primary font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s...`
                : "Resend the link"}
            </button>
          </p>
          <p className="text-[13px] text-surface-500 mt-3">
            Wrong email?{" "}
            <button
              type="button"
              onClick={resetToMagicLink}
              className="text-primary hover:underline"
            >
              Sign in with a different address
            </button>
          </p>
        </div>
      ) : forgotPasswordSent ? (
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-success-50 border border-success-100 flex items-center justify-center mx-auto mb-5">
            <Mail className="w-7 h-7 text-success" />
          </div>
          <h2 className="text-2xl font-semibold text-surface-900 mb-2">
            Reset link sent
          </h2>
          <p className="text-[15px] text-surface-500 leading-[1.6] mb-7 max-w-[320px] mx-auto">
            Check your email for a link to reset your password. It expires
            in 1 hour.
          </p>
          <button
            type="button"
            onClick={resetToLogin}
            className="text-[14px] text-primary font-medium hover:underline"
          >
            &larr; Back to sign in
          </button>
        </div>
      ) : (
        <>
          {/* ── Magic link form ── */}
          {activeView === "magic-link" && (
            <form onSubmit={handleMagicLink}>
              <div className="mb-3">
                <label
                  htmlFor="magic-email"
                  className="block text-[14px] font-medium text-surface-700 mb-1.5"
                >
                  Email address
                </label>
                <input
                  ref={emailInputRef}
                  id="magic-email"
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => {
                    if (email) validateEmail(email, true);
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-describedby={
                    emailError
                      ? "magic-email-error"
                      : emailSuggestion
                        ? "magic-email-suggestion"
                        : undefined
                  }
                  aria-invalid={!!emailError}
                  className={inputClasses(!!emailError)}
                />
                {emailError && (
                  <p
                    id="magic-email-error"
                    className="flex items-center gap-1 mt-1 text-[13px] text-destructive"
                    role="alert"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {emailError}
                  </p>
                )}
                {emailSuggestion && !emailError && (
                  <p
                    id="magic-email-suggestion"
                    className="mt-1 text-[13px] text-surface-500"
                  >
                    Did you mean{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(emailSuggestion);
                        setEmailSuggestion("");
                      }}
                      className="text-primary font-medium hover:underline cursor-pointer"
                    >
                      {emailSuggestion}
                    </button>
                    ?
                  </p>
                )}
              </div>

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
                loading={loadingAction === "magic-link"}
                disabled={!captchaVerified}
                aria-describedby="captcha-status"
                className="w-full mt-3"
              >
                Send magic link
              </Button>
            </form>
          )}

          {/* ── Password form ── */}
          {activeView === "password" && (
            <form onSubmit={handlePasswordSignIn}>
              <div className="mb-3">
                <label
                  htmlFor="password-email"
                  className="block text-[14px] font-medium text-surface-700 mb-1.5"
                >
                  Email address
                </label>
                <input
                  ref={emailInputRef}
                  id="password-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => {
                    if (email) validateEmail(email, false);
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-describedby={
                    emailError ? "password-email-error" : undefined
                  }
                  aria-invalid={!!emailError}
                  className={inputClasses(!!emailError)}
                />
                {emailError && (
                  <p
                    id="password-email-error"
                    className="flex items-center gap-1 mt-1 text-[13px] text-destructive"
                    role="alert"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password-input"
                    className="text-[14px] font-medium text-surface-700"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveView("forgot-password")}
                    className="text-[13px] text-primary hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    id="password-input"                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                      if (authError) setAuthError("");
                    }}
                    placeholder="Your password"
                    autoComplete="current-password"
                    aria-describedby={
                      passwordError ? "password-error" : undefined
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
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-700 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p
                    id="password-error"
                    className="flex items-center gap-1 mt-1 text-[13px] text-destructive"
                    role="alert"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {passwordError}
                  </p>
                )}
              </div>

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
                loading={loadingAction === "password"}
                disabled={!captchaVerified}
                aria-describedby="captcha-status"
                className="w-full mt-3"
              >
                Sign in
              </Button>
            </form>
          )}

          {/* ── Back to magic link ── */}
          {activeView === "password" && (
            <button
              type="button"
              onClick={() => {
                setActiveView("magic-link");
                setAuthError("");
                setPasswordError("");
              }}
              className="w-full text-center text-[14px] text-primary font-medium hover:underline cursor-pointer mt-5"
            >
              Use magic link instead
            </button>
          )}

          {/* ── Forgot password form ── */}
          {activeView === "forgot-password" && !forgotPasswordSent && (
            <form onSubmit={handleForgotPassword}>
              <div className="mb-3">
                <label
                  htmlFor="forgot-email"
                  className="block text-[14px] font-medium text-surface-700 mb-1.5"
                >
                  Email address
                </label>
                <input
                  ref={emailInputRef}
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => {
                    if (email) validateEmail(email, false);
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-describedby={
                    emailError ? "forgot-email-error" : undefined
                  }
                  aria-invalid={!!emailError}
                  className={inputClasses(!!emailError)}
                />
                {emailError && (
                  <p
                    id="forgot-email-error"
                    className="flex items-center gap-1 mt-1 text-[13px] text-destructive"
                    role="alert"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

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
                loading={loadingAction === "forgot-password"}
                disabled={!captchaVerified}
                aria-describedby="captcha-status"
                className="w-full mt-3"
              >
                Send reset link
              </Button>
            </form>
          )}

          {/* ── Toggle to password sign-in ── */}
          {activeView === "magic-link" && (
            <>
              <div className="flex items-center my-5" aria-hidden="true">
                <div className="flex-1 h-px bg-surface-200" />
                <span className="text-[12px] text-surface-500 uppercase tracking-wider px-3">
                  or
                </span>
                <div className="flex-1 h-px bg-surface-200" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveView("password");
                  setAuthError("");
                  setEmailError("");
                  setEmailSuggestion("");
                }}
                className="w-full h-11 flex items-center justify-center gap-2 bg-transparent text-surface-600 text-[14px] font-medium border-[1.5px] border-surface-200 rounded-lg cursor-pointer hover:bg-surface-50 hover:border-surface-300 active:scale-[0.98] transition-all duration-150"
              >
                <Lock className="w-4 h-4" />
                Sign in with password
              </button>
            </>
          )}

          {/* ── Sign-up link ── */}
          <p className="text-center text-[14px] text-surface-500 mt-8">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-primary font-medium hover:underline"
            >
              Sign up free
            </Link>
          </p>
        </>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

/* ── Loading skeleton ────────────────────────────────────── */
function LoginSkeleton() {
  return (
    <>
      <div className="h-7 w-[220px] bg-surface-100 rounded-md mb-2 animate-pulse mx-auto" />
      <div className="h-4 w-[180px] bg-surface-100 rounded mb-7 animate-pulse mx-auto" />
      <div className="h-11 w-full bg-surface-100 rounded-lg mb-3 animate-pulse" />
      <div className="h-11 w-full bg-surface-200 rounded-lg animate-pulse" />
    </>
  );
}
