import type { ReactNode } from "react";
import styles from "./Layout.module.css";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, actions }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  );
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] as string).slice(0, 2).toUpperCase();
  return `${(parts[0] as string)[0]}${(parts[parts.length - 1] as string)[0]}`.toUpperCase();
}

export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`${styles.avatar} ${small ? styles.avatarSmall : ""}`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className={styles.filterBar}>{children}</div>;
}

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
}

export function SearchField({ value, onChange, placeholder, label }: SearchFieldProps) {
  return (
    <div className={styles.search}>
      <input
        type="search"
        className={styles.searchInput}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
}

export function FilterSelect({ value, onChange, label, children }: FilterSelectProps) {
  return (
    <select
      className={styles.filterSelect}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  return (
    <div className={styles.segmented} role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={`${styles.segment} ${option.value === value ? styles.segmentActive : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? <span className={styles.segmentCount}>{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = pageNumbers(page, pageCount);

  return (
    <div className={styles.pagination}>
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ‹
      </button>
      {pages.map((entry, index) =>
        entry === null ? (
          <span key={`gap-${index}`} className={styles.mutedCell}>
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            className={`${styles.pageButton} ${entry === page ? styles.pageButtonActive : ""}`}
            aria-current={entry === page ? "page" : undefined}
            onClick={() => onPageChange(entry)}
          >
            {entry}
          </button>
        ),
      )}
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}

function pageNumbers(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const result: (number | null)[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) result.push(null);
  for (let current = start; current <= end; current++) result.push(current);
  if (end < pageCount - 1) result.push(null);
  result.push(pageCount);

  return result;
}

export function PrimaryCell({ title, subtitle, name }: { title: string; subtitle?: string; name?: string }) {
  return (
    <div className={styles.primaryCell}>
      {name ? <Avatar name={name} /> : null}
      <div>
        <div className={styles.cellTitle}>{title}</div>
        {subtitle ? <div className={styles.cellSub}>{subtitle}</div> : null}
      </div>
    </div>
  );
}

export function MutedCell({ children }: { children: ReactNode }) {
  return <span className={styles.mutedCell}>{children}</span>;
}

export function NumericCell({ children }: { children: ReactNode }) {
  return <span className={styles.numericCell}>{children}</span>;
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className={styles.rowActions}>{children}</div>;
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.statGrid}>{children}</div>;
}

export function SplitGrid({ children }: { children: ReactNode }) {
  return <div className={styles.splitGrid}>{children}</div>;
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}

export function InlineMeta({ children }: { children: ReactNode }) {
  return <div className={styles.inlineMeta}>{children}</div>;
}

export function ProgressBar({
  percent,
  tone = "neutral",
}: {
  percent: number;
  tone?: "neutral" | "success" | "warning";
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const toneClass =
    tone === "success" ? styles.progressSuccess : tone === "warning" ? styles.progressWarning : "";

  return (
    <div className={styles.progressTrack}>
      <div className={`${styles.progressFill} ${toneClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
