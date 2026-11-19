import type { ReactNode } from 'react';

export function ScreenHeader({ title, subtitle, right, eyebrow }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="pt-safe">
      <div className="flex items-end gap-3 px-5 pb-3 pt-5 lg:px-8 lg:pt-8">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-0.5 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-muted">{eyebrow}</div>}
          <h1 className="font-display text-[2rem] font-bold leading-tight lg:text-[2.25rem]">{title}</h1>
          {subtitle && <div className="mt-0.5 text-[0.9375rem] text-muted">{subtitle}</div>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-1 pb-1">{right}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ children, count, tone, right }: { children: ReactNode; count?: number; tone?: 'danger' | 'live'; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-1 pt-1">
      {tone === 'live' && (
        <span className="relative grid h-2.5 w-2.5 place-items-center text-success">
          <span className="pulse-ring absolute inset-0 rounded-full" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-success" />
        </span>
      )}
      <h2 className={`text-[0.8125rem] font-bold uppercase tracking-[0.07em] ${tone === 'danger' ? 'text-danger' : 'text-muted'}`}>
        {children}
      </h2>
      {count !== undefined && (
        <span
          className={`tnum rounded-full px-1.5 text-[0.75rem] font-semibold ${tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted'}`}
        >
          {count}
        </span>
      )}
      <div className="flex-1" />
      {right}
    </div>
  );
}
