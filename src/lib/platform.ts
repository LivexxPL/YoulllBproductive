import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

export async function haptic(kind: 'light' | 'medium' | 'success' = 'light'): Promise<void> {
  try {
    if (isNative) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
    } else if ('vibrate' in navigator) {
      navigator.vibrate(kind === 'success' ? [12, 40, 12] : 10);
    }
  } catch {
    /* brak wibracji – trudno */
  }
}

export const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
