import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useEffect } from 'react';
import { isNative } from './platform';
import { useSettings, type ThemePref } from '../state/settings';

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function resolveDark(pref: ThemePref): boolean {
  return pref === 'dark' || (pref === 'system' && media.matches);
}

export function applyTheme(pref: ThemePref) {
  const dark = resolveDark(pref);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', dark ? '#0b0d12' : '#f4f5f8');
  if (isNative) {
    SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  }
}

export function useThemeSync() {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
    const onChange = () => applyTheme(useSettings.getState().theme);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);
}

export function useIsDark(): boolean {
  const theme = useSettings((s) => s.theme);
  return resolveDark(theme);
}
