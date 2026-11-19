export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="ybp-g" x1="6" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D8BFF" />
          <stop offset="0.55" stopColor="#4F6BF5" />
          <stop offset="1" stopColor="#7A4FE0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#ybp-g)" />
      <path d="M2 20 Q2 2 20 2 H44 Q62 2 62 20 V22 H2 Z" fill="#fff" opacity="0.14" />
      <circle cx="22" cy="12" r="2.6" fill="#fff" opacity="0.85" />
      <circle cx="42" cy="12" r="2.6" fill="#fff" opacity="0.85" />
      <path d="M19 38.5l8.2 8.2L46 28" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="font-display text-[1.05rem] font-bold tracking-tight">
      Youlll<span className="text-accent">B</span>productive
    </span>
  );
}
