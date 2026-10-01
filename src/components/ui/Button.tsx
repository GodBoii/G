import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "success";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  // Gradient shades never change on hover, so white-text contrast holds in every state.
  primary: "bg-linear-to-r from-fuchsia-600 to-violet-600 text-white font-semibold enabled:hover:shadow-glow-fuchsia",
  secondary: "bg-white/5 border border-white/10 text-ink backdrop-blur enabled:hover:bg-white/10",
  ghost: "bg-transparent text-ink-muted enabled:hover:text-ink enabled:hover:bg-white/5",
  // Dark text on emerald-400 (≈ 10:1); white would fail AA.
  success: "bg-emerald-400 text-bg-950 font-semibold enabled:hover:shadow-glow-emerald",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  /** 44px square (quick-bet buttons). */
  icon: "size-11 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width. */
  block?: boolean;
}

export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "md", block = false): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-xl whitespace-nowrap select-none",
    "transition-[transform,box-shadow,background-color,color] duration-150 active:scale-[.97]",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
    VARIANTS[variant],
    SIZES[size],
    block ? "w-full" : "",
  ].join(" ");
}

export function Button({ variant = "secondary", size = "md", block = false, className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={`${buttonClasses(variant, size, block)} ${className}`} {...rest} />;
}
