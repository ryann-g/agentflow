export interface PricingPlan {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
}

import { proPriceValue } from "@/lib/pricing";

export const pricingPlans: PricingPlan[] = [
  {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "For agents getting started",
    features: [
      "10 active leads",
      "10 pipelines",
      "Daily email digest",
      "Mobile + desktop access",
    ],
    cta: "Get started free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    monthlyPrice: proPriceValue("monthly"),
    annualPrice: proPriceValue("annual"),
    description: "For serious solo agents",
    features: [
      "Unlimited leads",
      "Unlimited pipelines",
      "Daily email digest",
      "Custom follow-up reminders",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    href: "/signup",
    highlighted: true,
  },
];
