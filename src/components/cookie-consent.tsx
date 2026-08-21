"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, X } from "lucide-react";

const CONSENT_KEY = "agentflow_cookie_consent";

type ConsentState = "accepted" | "declined" | null;

export function getStoredConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(CONSENT_KEY);
  if (stored === "accepted" || stored === "declined") return stored;
  return null;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    }

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const dismiss = useCallback(
    (consent: ConsentState) => {
      if (!consent) return;
      localStorage.setItem(CONSENT_KEY, consent);
      setIsAnimating(false);
      setTimeout(() => {
        setVisible(false);
        setShouldRender(false);
      }, prefersReducedMotion ? 0 : 150);
      window.dispatchEvent(
        new CustomEvent("cookieconsent", { detail: { consent } })
      );
    },
    [prefersReducedMotion]
  );

  useEffect(() => {
    if (!shouldRender) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss("declined");
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [shouldRender, dismiss]);

  if (!shouldRender) return null;

  const enterStyle = prefersReducedMotion
    ? { opacity: 1 }
    : {
        opacity: isAnimating ? 1 : 0,
        transform: isAnimating ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 200ms cubic-bezier(0.23, 1, 0.32, 1), transform 200ms cubic-bezier(0.23, 1, 0.32, 1)",
      };

  const exitStyle = prefersReducedMotion
    ? {}
    : {
        opacity: 0,
        transform: "translateY(4px)",
        transition: "opacity 150ms cubic-bezier(0.23, 1, 0.32, 1), transform 150ms cubic-bezier(0.23, 1, 0.32, 1)",
      };

  return (
    <div
      role="alertdialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-full max-w-sm p-4 md:bottom-6 md:right-6"
      style={isAnimating ? enterStyle : { ...enterStyle, ...exitStyle }}
    >
      <div className="rounded-card border border-surface-200 bg-white p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
            <span
              id="cookie-title"
              className="text-sm font-semibold text-surface-900"
            >
              Cookie Preferences
            </span>
          </div>
          <button
            type="button"
            onClick={() => dismiss("declined")}
            aria-label="Dismiss cookie consent"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-button text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-600 active:scale-[0.97]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p
          id="cookie-desc"
          className="mb-4 text-sm leading-relaxed text-surface-600"
        >
          We use analytics to understand how you use AgentFlow and improve the
          product. No tracking cookies. No third-party ads. The app works
          exactly the same either way.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dismiss("declined")}
            className="flex-1 rounded-button border border-surface-200 bg-white px-4 py-2.5 text-sm font-medium text-surface-700 transition-all hover:bg-surface-50 hover:border-surface-300 active:scale-[0.97] active:bg-surface-100 min-h-[44px]"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => dismiss("accepted")}
            className="flex-1 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-700 active:scale-[0.97] active:bg-primary-800 min-h-[44px]"
          >
            Accept Analytics
          </button>
        </div>
      </div>
    </div>
  );
}
