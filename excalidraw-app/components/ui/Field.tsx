import clsx from "clsx";

import "./Field.scss";

import type { InputHTMLAttributes, ReactNode } from "react";

export type JayrrFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export const Field = ({ label, children, className }: JayrrFieldProps) => {
  return (
    <label className={clsx("jayrr-ui-field", className)}>
      <span className="jayrr-ui-field__label">{label}</span>
      {children}
    </label>
  );
};

export type JayrrInputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = ({ className, ...rest }: JayrrInputProps) => {
  return <input className={clsx("jayrr-ui-input", className)} {...rest} />;
};
