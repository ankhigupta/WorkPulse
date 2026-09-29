import type { ReactNode } from "react";
import styles from "./StatCard.module.css";

type Tone = "neutral" | "success" | "warning" | "error" | "info";

const iconToneClass: Record<Tone, string> = {
  neutral: styles.iconNeutral,
  success: styles.iconSuccess,
  warning: styles.iconWarning,
  error: styles.iconError,
  info: styles.iconInfo,
};

interface StatCardProps {
  label: string;
  value: string | number;
  /** Only ever rendered from real data — never a fabricated trend figure. */
  meta?: string;
  icon?: ReactNode;
  tone?: Tone;
}

export function StatCard({ label, value, meta, icon, tone = "neutral" }: StatCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon ? <span className={`${styles.icon} ${iconToneClass[tone]}`}>{icon}</span> : null}
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>
    </div>
  );
}
