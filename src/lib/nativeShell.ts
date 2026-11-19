import { isNative } from './platform';
import { popBack } from './hooks';
import { useUi } from '../state/ui';

let initialized = false;

/** Integracja z Androidem: przycisk „wstecz”. */
export async function initNativeShell() {
  if (initialized || !isNative) return;
  initialized = true;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', () => {
    if (popBack()) return;
    const ui = useUi.getState();
    if (ui.route !== 'today') {
      ui.navigate('today');
      return;
    }
    App.minimizeApp();
  });
}
