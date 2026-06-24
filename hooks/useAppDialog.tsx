import React, { useCallback, useRef, useState } from 'react';
import { Button } from '../components/Button';

type DialogState =
  | { type: 'alert'; title: string; message: string }
  | { type: 'confirm'; title: string; message: string };

export function useAppDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolveRef = useRef<(value: boolean) => void>(() => {});

  const close = useCallback((result: boolean) => {
    setDialog(null);
    resolveRef.current(result);
  }, []);

  const alert = useCallback((message: string, title = '알림'): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = () => resolve();
      setDialog({ type: 'alert', title, message });
    });
  }, []);

  const confirm = useCallback((message: string, title = '확인'): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ type: 'confirm', title, message });
    });
  }, []);

  const DialogHost = () => {
    if (!dialog) return null;

    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
        onClick={() => dialog.type === 'alert' && close(true)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
      >
        <div
          className="bg-white rounded-2xl shadow-md border border-orange-100/50 max-w-md w-full p-5 sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="app-dialog-title" className="text-lg font-bold text-gray-800 mb-3">
            {dialog.title}
          </h3>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed whitespace-pre-line">
            {dialog.message}
          </p>
          <div className="flex gap-3">
            {dialog.type === 'confirm' && (
              <Button variant="ghost" onClick={() => close(false)} className="flex-1 min-h-[48px]">
                취소
              </Button>
            )}
            <Button
              onClick={() => close(true)}
              className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
            >
              확인
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return { alert, confirm, DialogHost };
}
