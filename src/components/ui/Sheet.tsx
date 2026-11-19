import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBackHandler, useIsWide } from '../../lib/hooks';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  /** Pasek akcji przyklejony do dołu. */
  footer?: ReactNode;
  /** Na desktopie: pozycja okna. */
  placement?: 'center' | 'top';
  width?: string;
  label?: string;
  hideClose?: boolean;
}

/** Arkusz: na telefonie wysuwany od dołu (z przeciąganiem w dół), na desktopie okno modalne. */
export function Sheet({ open, onClose, children, title, footer, placement = 'center', width = '34rem', label, hideClose }: SheetProps) {
  const wide = useIsWide();
  const controls = useDragControls();
  useBackHandler(open, onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 z-50 flex ${wide ? (placement === 'top' ? 'items-start justify-center pt-[12vh]' : 'items-center justify-center p-6') : 'items-end'}`}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <motion.div
            className="absolute inset-0 bg-[rgb(10_12_20/0.42)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className={`relative flex max-h-[92dvh] w-full flex-col bg-surface text-ink shadow-[var(--shadow-pop)] ${
              wide ? 'rounded-[1.5rem]' : 'rounded-t-[1.75rem] pb-safe'
            }`}
            style={wide ? { maxWidth: width, maxHeight: placement === 'top' ? '76vh' : '88vh' } : undefined}
            initial={wide ? { opacity: 0, scale: 0.96, y: placement === 'top' ? -8 : 8 } : { y: '100%' }}
            animate={wide ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={wide ? { opacity: 0, scale: 0.97, y: placement === 'top' ? -6 : 6 } : { y: '100%' }}
            transition={wide ? { duration: 0.2, ease: [0.22, 1, 0.36, 1] } : { type: 'spring', damping: 34, stiffness: 380, mass: 0.9 }}
            drag={wide ? false : 'y'}
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <div
              className="shrink-0 touch-none select-none"
              onPointerDown={(e) => !wide && controls.start(e)}
            >
              {!wide && <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line-strong" />}
              {(title || !hideClose) && (
                <div className="flex items-center gap-2 px-5 pb-1 pt-3 sm:pt-4">
                  <div className="min-w-0 flex-1 font-display text-lg font-semibold">{title}</div>
                  {!hideClose && (
                    <button className="icon-btn -mr-2" onClick={onClose} aria-label="Zamknij">
                      <X size={20} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            {footer && <div className="shrink-0 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
