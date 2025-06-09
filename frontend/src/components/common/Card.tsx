import React, { forwardRef, HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type CardVariant = 'default' | 'outlined' | 'filled';
type CardPadding = 'none' | 'small' | 'medium' | 'large';
type CardElevation = 0 | 1 | 2 | 3;

interface CardProps extends HTMLAttributes<HTMLElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  elevation?: CardElevation;
  disabled?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

export const Card = forwardRef<HTMLElement, CardProps>(
  (
    {
      header,
      footer,
      variant = 'default',
      padding = 'medium',
      elevation = 1,
      disabled = false,
      as: Component = 'div',
      className,
      children,
      onClick,
      onKeyDown,
      tabIndex,
      ...rest
    },
    ref
  ) => {
    const isClickable = !!onClick && !disabled;

    const baseStyles = cn(
      'rounded-lg transition-all',
      {
        'cursor-pointer hover:shadow-lg': isClickable,
        'opacity-50 cursor-not-allowed': disabled,
      }
    );

    const variantStyles = {
      default: 'bg-white',
      outlined: 'bg-white border border-gray-200',
      filled: 'bg-gray-50',
    };

    const paddingStyles = {
      none: 'p-0',
      small: 'p-3',
      medium: 'p-4',
      large: 'p-6',
    };

    const elevationStyles = {
      0: 'shadow-none',
      1: 'shadow-sm',
      2: 'shadow-md',
      3: 'shadow-lg',
    };

    const classes = cn(
      baseStyles,
      variantStyles[variant],
      paddingStyles[padding],
      elevationStyles[elevation],
      className
    );

    const handleClick = (e: React.MouseEvent<HTMLElement>): void => {
      if (!disabled && onClick) {
        onClick(e);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>): void => {
      if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        if (onClick) {
          // Call onClick directly with a synthetic event that has the required properties
          onClick({
            ...e,
            type: 'click',
            detail: 1,
            pageX: 0,
            pageY: 0,
            screenX: 0,
            screenY: 0,
            clientX: 0,
            clientY: 0,
            button: 0,
            buttons: 0,
          } as unknown as React.MouseEvent<HTMLElement>);
        }
      }
      if (onKeyDown) {
        onKeyDown(e);
      }
    };

    const cardContent = (
      <>
        {header && (
          <div className={cn('card-header', {
            '-m-4 mb-4 p-4 border-b border-gray-200': padding === 'medium' && header,
            '-m-3 mb-3 p-3 border-b border-gray-200': padding === 'small' && header,
            '-m-6 mb-6 p-6 border-b border-gray-200': padding === 'large' && header,
          })}>
            {header}
          </div>
        )}
        
        <div className="card-body">
          {children}
        </div>
        
        {footer && (
          <div className={cn('card-footer', {
            '-m-4 mt-4 p-4 border-t border-gray-200': padding === 'medium' && footer,
            '-m-3 mt-3 p-3 border-t border-gray-200': padding === 'small' && footer,
            '-m-6 mt-6 p-6 border-t border-gray-200': padding === 'large' && footer,
          })}>
            {footer}
          </div>
        )}
      </>
    );

    const componentProps = {
      ref: ref as React.Ref<HTMLElement>,
      className: classes,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      tabIndex: isClickable ? (tabIndex ?? 0) : tabIndex,
      role: isClickable ? 'button' : undefined,
      'aria-disabled': disabled || undefined,
      ...rest,
    };

    return React.createElement(Component, componentProps, cardContent);
  }
);

Card.displayName = 'Card';