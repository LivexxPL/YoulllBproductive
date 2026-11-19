import type { ReactNode } from 'react';

export function Card({ title, icon, children, description }: { title: string; icon?: ReactNode; children: ReactNode; description?: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 px-3 pb-2">
        {icon && <span className="text-muted">{icon}</span>}
        <h2 className="text-[0.8125rem] font-bold uppercase tracking-[0.07em] text-muted">{title}</h2>
      </div>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
      {description && <p className="px-3 pt-2 text-[0.8125rem] leading-relaxed text-muted">{description}</p>}
    </section>
  );
}

export function SettingRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[0.9375rem] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[0.8125rem] font-semibold transition-all ${
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-3'}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-[1.375rem]' : 'left-0.5'}`}
      />
    </button>
  );
}

