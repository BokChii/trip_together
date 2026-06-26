import { RefObject, useEffect } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseModalA11yOptions {
  active: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onEscape?: () => void;
}

export function useModalA11y({ active, panelRef, onEscape }: UseModalA11yOptions) {
  useEffect(() => {
    if (!active) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const { style: bodyStyle } = document.body;
    const prev = {
      position: bodyStyle.position,
      top: bodyStyle.top,
      left: bodyStyle.left,
      right: bodyStyle.right,
      width: bodyStyle.width,
      overflow: bodyStyle.overflow,
    };

    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = '0';
    bodyStyle.right = '0';
    bodyStyle.width = '100%';
    bodyStyle.overflow = 'hidden';

    const getFocusables = (panel: HTMLElement) =>
      Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];

    const rafId = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusables(panel);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.setAttribute('tabindex', '-1');
        panel.focus();
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusables(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      bodyStyle.position = prev.position;
      bodyStyle.top = prev.top;
      bodyStyle.left = prev.left;
      bodyStyle.right = prev.right;
      bodyStyle.width = prev.width;
      bodyStyle.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
      previouslyFocused?.focus?.();
    };
  }, [active, panelRef, onEscape]);
}
