import type { ReactNode } from "react";
import { IconPulse } from "../../app/icons";
import styles from "./AuthLayout.module.css";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <div className={styles.formSide}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <IconPulse />
          </span>
          <span className={styles.brandName}>WorkPulse</span>
        </div>

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>

        {children}

        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>

      <aside className={styles.panel}>
        <h2 className={styles.panelTitle}>Every store, every shift, one calm view.</h2>
        <p className={styles.panelBody}>
          Attendance, corrections and payroll for your whole organization, in one place.
        </p>
      </aside>
    </div>
  );
}
