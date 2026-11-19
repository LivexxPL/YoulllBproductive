import { motion } from 'motion/react';

interface Props {
  checked: boolean;
  color: string;
  onToggle: () => void;
  size?: number;
  label?: string;
}

/** Okrągły checkbox w stylu Things – obwódka w kolorze kategorii, animowany ptaszek. */
export function CheckCircle({ checked, color, onToggle, size = 24, label = 'Oznacz jako zrobione' }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="group relative -m-2 grid shrink-0 place-items-center p-2"
    >
      <motion.span
        className="grid place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          border: `2px solid ${color}`,
          background: checked ? color : 'transparent',
        }}
        animate={{ scale: checked ? [1, 0.82, 1.08, 1] : 1 }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
        whileTap={{ scale: 0.86 }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none">
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            stroke={checked ? '#fff' : color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.28, ease: 'easeOut', delay: checked ? 0.08 : 0 }}
          />
        </svg>
        {!checked && (
          <span
            className="pointer-events-none absolute inset-2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
            style={{ background: `${color}1f` }}
          />
        )}
      </motion.span>
    </button>
  );
}
