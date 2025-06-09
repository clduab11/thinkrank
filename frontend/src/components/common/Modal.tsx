import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

type ModalSize = 'small' | 'medium' | 'large' | 'full';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  footer?: React.ReactNode;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  overlayClassName?: string;
  portalTarget?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  footer,
  size = 'medium',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
  overlayClassName,
  portalTarget,
  children,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus the close button or first focusable element
      setTimeout(() => {
        const closeButton = modalRef.current?.querySelector('[aria-label="Close modal"]') as HTMLElement;
        if (closeButton) {
          closeButton.focus();
        } else {
          const firstFocusable = modalRef.current?.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement;
          firstFocusable?.focus();
        }
      }, 0);
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [isOpen]);

  // Handle focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const focusableArray = Array.from(focusableElements) as HTMLElement[];
    
    if (focusableArray.length === 0) return;

    const firstElement = focusableArray[0];
    const lastElement = focusableArray[focusableArray.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }, []);

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const sizeStyles = {
    small: 'max-w-sm',
    medium: 'max-w-lg',
    large: 'max-w-2xl',
    full: 'max-w-full mx-4',
  };

  const modalContent = (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black bg-opacity-50',
        overlayClassName
      )}
      onClick={handleOverlayClick}
      data-testid="modal-overlay"
    >
      <div
        ref={modalRef}
        className={cn(
          'relative bg-white rounded-lg shadow-xl',
          'w-full',
          sizeStyles[size],
          'max-h-[90vh] overflow-hidden flex flex-col',
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        data-testid="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        {(title || true) && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            <button
              type="button"
              className={cn(
                'rounded-lg p-1.5 text-gray-400 hover:text-gray-600',
                'hover:bg-gray-100 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-primary-500',
                { 'ml-auto': !title }
              )}
              onClick={onClose}
              aria-label="Close modal"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (portalTarget) {
    const target = document.querySelector(portalTarget);
    if (target) {
      return createPortal(modalContent, target);
    }
  }

  return createPortal(modalContent, document.body);
};