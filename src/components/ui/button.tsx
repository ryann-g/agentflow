import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "cta" | "accent" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-button transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer";

    const variants = {
      primary: "bg-primary text-white hover:bg-primary-700 active:bg-primary-800",
      cta: "bg-cta text-white hover:bg-cta-600 active:bg-cta-700",
      secondary: "bg-surface-100 text-surface-700 hover:bg-surface-200 active:bg-surface-300 border border-surface-200",
      accent: "bg-accent text-white hover:bg-accent-600 active:bg-accent-800",
      destructive: "bg-destructive text-white hover:bg-destructive-700 active:bg-destructive-700",
      ghost: "text-surface-600 hover:bg-surface-100 active:bg-surface-200",
    };

    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-11 px-4 text-sm min-h-[44px]",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
