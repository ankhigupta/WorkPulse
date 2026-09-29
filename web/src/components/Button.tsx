import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "ivory";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: Variant;
  size?: "default" | "small";
  loading?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "default",
  loading = false,
  fullWidth = false,
  iconOnly = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classNames = [
    styles.base,
    styles[variant],
    size === "small" && styles.small,
    fullWidth && styles.fullWidth,
    iconOnly && styles.iconOnly,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classNames} disabled={disabled || loading} {...props}>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
