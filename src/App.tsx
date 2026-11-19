import { useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AppShell } from './components/AppShell';
import { QuickAdd } from './components/QuickAdd';
import { ReminderEditor } from './components/ReminderEditor';
import { Toaster } from './components/ui/Toaster';
import { LogoMark } from './components/Logo';
import { startDataLayer, useDataReady } from './data/store';
import { useThemeSync } from './lib/theme';
import { unlockAudioOnFirstGesture } from './lib/sound';
import { useUi } from './state/ui';
import { TodayScreen } from './screens/TodayScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { AllScreen } from './screens/AllScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CountersScreen } from './screens/CountersScreen';
import { initNativeShell } from './lib/nativeShell';
import { AlarmOverlay } from './components/AlarmOverlay';
import { startNotifications } from './notifications/service';

startDataLayer();

export function App() {
  useThemeSync();
  const ready = useDataReady();
  const route = useUi((s) => s.route);

  useEffect(() => {
    unlockAudioOnFirstGesture();
    initNativeShell();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  useEffect(() => {
    if (ready) startNotifications().catch((e) => console.warn('[notifications]', e));
  }, [ready]);

  if (!ready) {
    return (
      <div className="grid h-full place-items-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
          <LogoMark size={56} />
        </motion.div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <AppShell>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={route}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={route === 'calendar' ? 'h-full' : ''}
          >
            {route === 'today' && <TodayScreen />}
            {route === 'calendar' && <CalendarScreen />}
            {route === 'all' && <AllScreen />}
            {route === 'counters' && <CountersScreen />}
            {route === 'settings' && <SettingsScreen />}
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <QuickAdd />
      <ReminderEditor />
      <AlarmOverlay />
      <Toaster />
    </MotionConfig>
  );
}
