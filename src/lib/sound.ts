/**
 * Dźwięk alarmu w aplikacji (przeglądarka + Android, gdy aplikacja jest otwarta).
 * Ten sam plik `alarm.wav` jest użyty jako dźwięk kanału powiadomień na Androidzie.
 */
let audio: HTMLAudioElement | null = null;
let stopTimer: number | null = null;
let unlocked = false;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}sounds/alarm.wav`);
    audio.preload = 'auto';
  }
  return audio;
}

/** Przeglądarki blokują dźwięk bez interakcji – „odblokuj” go przy pierwszym kliknięciu. */
export function unlockAudioOnFirstGesture() {
  if (unlocked) return;
  const handler = () => {
    unlocked = true;
    const a = getAudio();
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      })
      .catch(() => {
        a.muted = false;
      });
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler, { once: false });
  window.addEventListener('keydown', handler, { once: false });
}

export function playAlarm({ loop = true, maxMs = 60_000 }: { loop?: boolean; maxMs?: number } = {}) {
  const a = getAudio();
  a.loop = loop;
  a.volume = 1;
  a.currentTime = 0;
  a.play().catch(() => {
    /* zablokowane przez przeglądarkę */
  });
  if (stopTimer) window.clearTimeout(stopTimer);
  stopTimer = window.setTimeout(stopAlarm, maxMs);
  if ('vibrate' in navigator) navigator.vibrate?.([400, 200, 400, 200, 400]);
}

export function stopAlarm() {
  if (stopTimer) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  if ('vibrate' in navigator) navigator.vibrate?.(0);
}

export function previewSound() {
  playAlarm({ loop: false, maxMs: 6000 });
}
