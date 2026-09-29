import styles from "./StatusBadge.module.css";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral" | "outline";

interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
  /** Outline badges (a *requested* role) carry no status dot. */
  dot?: boolean;
}

export function StatusBadge({ label, tone, dot = true }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {dot && tone !== "outline" ? <span className={styles.dot} aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

export function activeTone(isActive: boolean): StatusTone {
  return isActive ? "success" : "neutral";
}

export function reviewTone(status: "PENDING" | "APPROVED" | "REJECTED"): StatusTone {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "error";
  return "warning";
}
