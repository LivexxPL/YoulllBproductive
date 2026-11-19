import { AnimatePresence, motion } from 'motion/react';
import { CircleCheckBig, Info, TriangleAlert } from 'lucide-react';
import { useUi } from '../../state/ui';

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+var(--safe-bottom))] z-[70] flex flex-col items-center gap-2 pl-4 pr-[5.25rem] sm:px-4 lg:bottom-6">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', damping: 28, stiffness: 420 }}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#151925] py-2.5 pl-3.5 pr-2 text-sm text-white shadow-[var(--shadow-pop)] dark:bg-[#eef1f7] dark:text-[#101828]"
          >
            {t.tone === 'success' ? (
              <CircleCheckBig size={18} className="shrink-0 text-[#3ccf9f] dark:text-[#12a37a]" />
            ) : t.tone === 'danger' ? (
              <TriangleAlert size={18} className="shrink-0 text-[#ff8a8e] dark:text-[#e5484d]" />
            ) : (
              <Info size={18} className="shrink-0 opacity-70" />
            )}
            <span className="py-1 font-medium">{t.message}</span>
            {t.onAction ? (
              <button
                className="ml-1 rounded-xl px-3 py-1.5 font-semibold text-[#9db0ff] hover:bg-white/10 dark:text-[#4f6bf5] dark:hover:bg-black/5"
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
              >
                {t.actionLabel ?? 'Cofnij'}
              </button>
            ) : (
              <span className="w-1.5" />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
