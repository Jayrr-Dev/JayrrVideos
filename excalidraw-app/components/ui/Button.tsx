import clsx from "clsx";
import { forwardRef } from "react";

import "./Button.scss";

import type { ButtonHTMLAttributes } from "react";

export type JayrrButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type JayrrButtonSize = "medium" | "large";

export type JayrrButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: JayrrButtonVariant;
  size?: JayrrButtonSize;
  fullWidth?: boolean;
  busy?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, JayrrButtonProps>(
  (
    {
      variant = "primary",
      size = "medium",
      fullWidth = false,
      busy = false,
      className,
      disabled,
      type = "button",
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "jayrr-ui-button",
          `jayrr-ui-button--${variant}`,
          `jayrr-ui-button--${size}`,
          fullWidth ? "jayrr-ui-button--full" : undefined,
          className,
        )}
        disabled={disabled || busy}
        aria-busy={busy}
        type={type}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
