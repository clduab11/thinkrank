import React, { forwardRef, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

type ButtonAsButton = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & {
    as?: 'button';
  };

type ButtonAsAnchor = ButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> & {
    as: 'a';
  };

type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const LoadingSpinner: React.FC = () => (
  <svg
    data-testid="loading-spinner"
    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (props, ref) => {
    const {
      as: Component = 'button',
      variant = 'primary',
      size = 'medium',
      fullWidth = false,
      loading = false,
      disabled,
      className,
      children,
      onClick,
      ...rest
    } = props;

    const baseStyles = cn(
      'inline-flex items-center justify-center font-medium rounded-md transition-colors',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      {
        'w-full': fullWidth,
        'opacity-75': loading,
      }
    );

    const variantStyles = {
      primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
      secondary: 'bg-secondary-600 text-white hover:bg-secondary-700 focus:ring-secondary-500',
      danger: 'bg-error text-white hover:bg-red-700 focus:ring-red-500',
    };

    const sizeStyles = {
      small: 'px-3 py-1.5 text-sm',
      medium: 'px-4 py-2 text-base',
      large: 'px-6 py-3 text-lg',
    };

    const classes = cn(
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      className
    );

    const handleClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement> | React.KeyboardEvent<HTMLButtonElement | HTMLAnchorElement>): void => {
      if (loading || disabled) return;
      if (onClick && 'detail' in e) {
        onClick(e as React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(e);
      }
    };

    if (Component === 'a') {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {loading && <LoadingSpinner />}
          {children}
        </a>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        disabled={disabled || loading}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {loading && <LoadingSpinner />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';