import React, { useCallback, useId, useRef } from 'react';
import { LucideIcon, X } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Accessible name when no ModalHeader title is rendered */
  ariaLabel?: string;
  /** Links to ModalHeader title id */
  titleId?: string;
  size?: 'md' | 'lg';
  zIndex?: number;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  scrollable?: boolean;
  panelClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
  ariaLabel,
  titleId,
  size = 'md',
  zIndex = 50,
  closeOnBackdrop = true,
  closeOnEscape = true,
  scrollable = false,
  panelClassName = '',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const fallbackTitleId = useId();
  const labelledBy = titleId ?? fallbackTitleId;

  const handleEscape = useCallback(() => {
    if (closeOnEscape) onClose();
  }, [closeOnEscape, onClose]);

  useModalA11y({
    active: open,
    panelRef,
    onEscape: closeOnEscape ? handleEscape : undefined,
  });

  if (!open) return null;

  const sizeClass = size === 'lg' ? 'sm:max-w-lg' : '';
  const scrollClass = scrollable ? 'max-h-[90vh] overflow-y-auto' : '';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
      style={{ zIndex }}
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId ? labelledBy : undefined}
        aria-label={!titleId ? ariaLabel : undefined}
        className={`bg-white rounded-2xl shadow-md border border-orange-100/50 max-w-md w-full p-5 sm:p-6 ${sizeClass} ${scrollClass} ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

interface ModalHeaderProps {
  title: string;
  titleId?: string;
  icon?: LucideIcon | React.ReactNode;
  iconWrapperClassName?: string;
  iconClassName?: string;
  showClose?: boolean;
  onClose?: () => void;
  className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  titleId,
  icon,
  iconWrapperClassName = 'bg-orange-50 p-2 rounded-lg',
  iconClassName = 'w-5 h-5 text-orange-600',
  showClose = false,
  onClose,
  className = '',
}) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === 'function') {
      const Icon = icon as LucideIcon;
      return <Icon className={iconClassName} />;
    }
    return icon;
  };

  if (showClose) {
    return (
      <div className={`flex items-center justify-between mb-4 ${className}`}>
        <h3 id={titleId} className="text-lg font-bold text-gray-900">
          {title}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 mb-4 ${className}`}>
      {icon && <div className={iconWrapperClassName}>{renderIcon()}</div>}
      <h3 id={titleId} className="text-lg sm:text-xl font-bold text-gray-800">
        {title}
      </h3>
    </div>
  );
};

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className = '' }) => (
  <div className={`flex flex-col sm:flex-row gap-3 ${className}`}>{children}</div>
);
