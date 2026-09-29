import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "hero";
  flush?: boolean;
  children: ReactNode;
}

export function Card({ variant = "default", flush = false, children, className, ...props }: CardProps) {
  const classNames = [
    styles.card,
    variant === "elevated" && styles.elevated,
    variant === "hero" && styles.hero,
    flush && styles.flush,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h2 className={styles.title}>{title}</h2>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
