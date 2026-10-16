import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  optional?: boolean;
}

export function Field({ label, htmlFor, error, hint, children, optional }: FieldProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {optional && <span className="field__optional"> (opcjonalnie)</span>}
      </label>
      {children}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="field__hint">{hint}</p>
      )}
    </div>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <div className="select">
      <select className={`control ${invalid ? "is-invalid" : ""} ${className ?? ""}`} {...rest}>
        {children}
      </select>
      <ChevronDown size={18} className="select__chevron" aria-hidden />
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function TextInput({ invalid, className, ...rest }: InputProps) {
  return <input className={`control ${invalid ? "is-invalid" : ""} ${className ?? ""}`} {...rest} />;
}
