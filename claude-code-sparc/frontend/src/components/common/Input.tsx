import React, { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type InputSize = 'small' | 'medium' | 'large';

interface InputBaseProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  fullWidth?: boolean;
  size?: InputSize;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
  multiline?: boolean;
  rows?: number;
}

type InputAsInput = InputBaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, keyof InputBaseProps> & {
    multiline?: false;
  };

type InputAsTextarea = InputBaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof InputBaseProps> & {
    multiline: true;
  };

type InputProps = InputAsInput | InputAsTextarea;

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  (props, ref) => {
    const {
      label,
      error,
      helperText,
      required,
      fullWidth = false,
      size = 'medium',
      prefix,
      suffix,
      className,
      multiline = false,
      rows,
      id,
      name,
      ...rest
    } = props;

    const inputId = id || name;

    const baseStyles = cn(
      'block rounded-md border transition-colors',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'placeholder:text-gray-400',
      {
        'w-full': fullWidth,
        'border-gray-300 focus:border-primary-500 focus:ring-primary-500': !error,
        'border-error focus:border-error focus:ring-error': error,
      }
    );

    const sizeStyles = {
      small: 'py-1 px-2 text-sm',
      medium: 'py-2 px-3 text-base',
      large: 'py-3 px-4 text-lg',
    };

    const inputClasses = cn(
      baseStyles,
      sizeStyles[size],
      {
        'pl-10': prefix,
        'pr-10': suffix,
      },
      className
    );

    const renderInput = (): React.ReactElement => {
      if (multiline) {
        return (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={inputId}
            name={name}
            rows={rows}
            className={inputClasses}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        );
      }

      return (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          id={inputId}
          name={name}
          className={inputClasses}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      );
    };

    return (
      <div className={cn({ 'w-full': fullWidth })}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {prefix && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {prefix}
            </div>
          )}
          
          {renderInput()}
          
          {suffix && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {suffix}
            </div>
          )}
        </div>
        
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-error">
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';