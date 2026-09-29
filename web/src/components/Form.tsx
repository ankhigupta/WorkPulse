import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import styles from "./Form.module.css";

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}

function FieldShell({ label, error, hint, htmlFor, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
      {!error && hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
      <input
        id={id}
        className={`${styles.control} ${error ? styles.invalid : ""}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id"> {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function SelectField({ label, error, hint, children, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
      <select
        id={id}
        className={`${styles.control} ${error ? styles.invalid : ""}`}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({ label, error, hint, ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        className={`${styles.control} ${error ? styles.invalid : ""}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "type"> & { label: string }) {
  const id = useId();
  return (
    <div className={styles.checkboxRow}>
      <input id={id} type="checkbox" className={styles.checkbox} {...props} />
      <label className={styles.checkboxLabel} htmlFor={id}>
        {label}
      </label>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <div className={styles.formError} role="alert">
      {message}
    </div>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}
