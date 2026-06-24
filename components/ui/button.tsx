import { type ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300",
  secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100 disabled:text-brand-300",
  outline: "border border-ink-900/15 bg-white text-ink-900 hover:bg-sand-100 disabled:text-ink-900/40",
  ghost: "text-ink-900/70 hover:bg-ink-900/5 hover:text-ink-900",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export const buttonClasses = (variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) =>
  cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    className
  );

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />
  )
);
Button.displayName = "Button";

type ButtonLinkProps = BaseProps & {
  href: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className">;

export function ButtonLink({ variant = "primary", size = "md", className, href, ...props }: ButtonLinkProps) {
  return <Link href={href} className={buttonClasses(variant, size, className)} {...props} />;
}
