"use client";

import dynamic from "next/dynamic";

// Client boundary for ssr:false — Next 16 forbids it directly inside
// Server Components (Turbopack enforces what webpack only warned about).
const AuthCallbackRescue = dynamic(
  () => import("@/components/auth-callback-rescue").then((mod) => mod.AuthCallbackRescue),
  { ssr: false }
);

export default function AuthCallbackRescueClient() {
  return <AuthCallbackRescue />;
}
