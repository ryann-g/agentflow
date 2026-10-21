import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/ui/sw-register";
import { proPriceValue } from "@/lib/pricing";
import { ConsentAwareAnalytics } from "@/components/consent-aware-analytics";
import { CookieConsent } from "@/components/cookie-consent";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

const appUrl = "https://agent-flow.app";

export const metadata: Metadata = {
  title: "AgentFlow — The CRM for agents who hate CRMs",
  description:
    "Dead-simple contact management and follow-up for solo real estate agents. No automations. No dashboards. Just who to call today.",
  manifest: "/manifest.json",
  alternates: {
    canonical: appUrl,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AgentFlow",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "AgentFlow",
    description: "Dead-simple CRM for solo real estate agents. Track leads, manage pipelines, and never miss a follow-up.",
    type: "website",
    siteName: "AgentFlow",
    url: appUrl,
    images: [
      {
        url: `${appUrl}/icons/icon-512.png`,
        width: 512,
        height: 512,
        alt: "AgentFlow — CRM for real estate agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentFlow",
    description: "Dead-simple CRM for solo real estate agents. Track leads, manage pipelines, and never miss a follow-up.",
    images: [`${appUrl}/icons/icon-512.png`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F766E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <head>
        {/* Preconnect to Supabase — saves ~100-200ms on first API call */}
        <link rel="preconnect" href="https://fsxdduvwshirrheenmag.supabase.co" />
        {/* Preconnect to Cloudflare Turnstile — saves ~100-300ms on first widget load (esp. mobile/4G) */}
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
        {/* DNS-prefetch for third-party analytics and error tracking */}
        <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
        <link rel="dns-prefetch" href="https://browser.sentry-cdn.com" />
        {/* JSON-LD structured data for Google rich snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "AgentFlow",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description:
                "Dead-simple contact management and follow-up for solo real estate agents.",
              url: appUrl,
              offers: {
                "@type": "AggregateOffer",
                lowPrice: "0",
                highPrice: String(proPriceValue("monthly")),
                priceCurrency: "USD",
                offerCount: "2",
                offers: [
                  {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "USD",
                    name: "Free",
                    description: "10 active leads, 10 pipelines, daily email digest",
                  },
                  {
                    "@type": "Offer",
                    price: String(proPriceValue("monthly")),
                    priceCurrency: "USD",
                    name: "Pro",
                    description: "Unlimited leads, unlimited pipelines, priority support",
                    priceSpecification: {
                      "@type": "UnitPriceSpecification",
                      price: String(proPriceValue("monthly")),
                      priceCurrency: "USD",
                      billingDuration: "P1M",
                    },
                  },
                ],
              },
              applicationSubCategory: "CRM, Real Estate Software",
              featureList:
                "Contact management, Pipeline tracking, Daily follow-up, CSV import, Lead scoring",
            }),
          }}
        />
      </head>
      <body className="font-body antialiased min-h-screen">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <ServiceWorkerRegistration />
        {children}
        <CookieConsent />
        <ConsentAwareAnalytics />
      </body>
    </html>
  );
}
