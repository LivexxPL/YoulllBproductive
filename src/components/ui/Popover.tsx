import { AnimatePresence, motion } from 'motion/react';
import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useBackHandler } from '../../lib/hooks';

interface PopoverProps {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  align?: 'start' | 'end';
}

/** Lekkie menu przyklejone do przycisku (portal, pozycja fixed, odwraca się w górę). */
export function Popover({ anchor, open, onClose, children, width = 220, align = 'end' }: PopoverProps) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  useBackHandler(open, onClose);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const up = r.bottom + 260 > vh && r.top > 260;
      let left = align === 'end' ? r.right - width : r.left;
      left = Math.max(8, Math.min(left, vw - width - 8));
      setPos({ top: up ? r.top - 6 : r.bottom + 6, left, up });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, width, align]);

  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
          <motion.div
            className="fixed z-[61] overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]"
            style={{
              left: pos.left,
              width,
              top: pos.up ? undefined : pos.top,
              bottom: pos.up ? window.innerHeight - pos.top : undefined,
              transformOrigin: pos.up ? 'bottom right' : 'top right',
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function MenuItem({
  icon,
  children,
  hint,
  onClick,
  tone,
}: {
  icon?: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  onClick: () => void;
  tone?: 'danger';
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[0.9375rem] font-medium transition-colors hover:bg-surface-2 active:bg-surface-3 ${
        tone === 'danger' ? 'text-danger' : 'text-ink'
      }`}
    >
      {icon && <span className="grid w-5 place-items-center text-muted">{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint && <span className="tnum text-xs text-faint">{hint}</span>}
    </button>
  );
}
