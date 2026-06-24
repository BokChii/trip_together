import React, { useCallback, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Modal, ModalFooter, ModalHeader } from '../components/Modal';

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

    const titleId = 'app-dialog-title';
    const isConfirm = dialog.type === 'confirm';

    return (
      <Modal
        open
        onClose={() => close(isConfirm ? false : true)}
        titleId={titleId}
        zIndex={60}
        closeOnBackdrop={!isConfirm}
        closeOnEscape
      >
        <ModalHeader title={dialog.title} titleId={titleId} />
        <p className="text-sm text-gray-600 mb-6 leading-relaxed whitespace-pre-line">
          {dialog.message}
        </p>
        <ModalFooter>
          {isConfirm && (
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
        </ModalFooter>
      </Modal>
    );
  };

  return { alert, confirm, DialogHost };
}
