import { useRef, useState } from 'react';
import { Database, Download, Monitor, Moon, Palette, Plus, Sparkles, Sun, Trash, Upload, Wand2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, Segmented, SettingRow } from '../components/ui/Settings';
import { Sheet } from '../components/ui/Sheet';
import { MenuItem, Popover } from '../components/ui/Popover';
import { NotificationSettings } from '../components/NotificationSettings';
import { createCategory, deleteCategory, updateCategory } from '../data/actions';
import { exportBackup, importBackup, parseBackup, type BackupFile } from '../data/backup';
import { addDemoData } from '../data/demo';
import { useCategories } from '../data/store';
import { CATEGORY_COLOR_KEYS, CATEGORY_COLORS } from '../lib/colors';
import { durationLabel } from '../lib/dates';
import type { Category } from '../lib/types';
import { settingsSnapshot, useSettings, type ThemePref } from '../state/settings';
import { toast } from '../state/ui';

export function SettingsScreen() {
  return (
    <div className="mx-auto max-w-2xl">
      <ScreenHeader title="Ustawienia" />
      <div className="space-y-5 px-3 pb-10 sm:px-5 lg:px-8">
        <Appearance />
        <NotificationSettings />
        <Defaults />
        <Categories />
        <DataSection />
        <About />
      </div>
    </div>
  );
}

function Appearance() {
  const theme = useSettings((s) => s.theme);
  const weekStartsOn = useSettings((s) => s.weekStartsOn);
  const set = useSettings((s) => s.set);
  return (
    <Card title="Wygląd" icon={<Palette size={15} />}>
      <SettingRow label="Motyw" hint="Domyślnie tak jak w systemie">
        <Segmented<ThemePref>
          value={theme}
          onChange={(v) => set({ theme: v })}
          options={[
            { value: 'system', label: <><Monitor size={14} /> Auto</> },
            { value: 'light', label: <><Sun size={14} /> Jasny</> },
            { value: 'dark', label: <><Moon size={14} /> Ciemny</> },
          ]}
        />
      </SettingRow>
      <SettingRow label="Pierwszy dzień tygodnia">
        <Segmented<0 | 1>
          value={weekStartsOn}
          onChange={(v) => set({ weekStartsOn: v })}
          options={[
            { value: 1, label: 'Poniedziałek' },
            { value: 0, label: 'Niedziela' },
          ]}
        />
      </SettingRow>
    </Card>
  );
}

function Defaults() {
  const defaultDurationMin = useSettings((s) => s.defaultDurationMin);
  const allDayAlarmTime = useSettings((s) => s.allDayAlarmTime);
  const set = useSettings((s) => s.set);
  return (
    <Card title="Nowe przypomnienia" icon={<Wand2 size={15} />}>
      <SettingRow label="Domyślny czas trwania" hint="Dla wpisów z godziną (wpływa na wygląd w kalendarzu)">
        <Segmented<number>
          value={defaultDurationMin}
          onChange={(v) => set({ defaultDurationMin: v })}
          options={[0, 15, 30, 60].map((v) => ({ value: v, label: v ? durationLabel(v) : 'Brak' }))}
        />
      </SettingRow>
      <SettingRow label="Powiadomienie dla „cały dzień”" hint="O której przypomnieć o wpisach bez godziny">
        <input
          type="time"
          value={allDayAlarmTime}
          onChange={(e) => e.target.value && set({ allDayAlarmTime: e.target.value })}
          className="field tnum h-10 w-28 py-0 text-center font-semibold"
        />
      </SettingRow>
    </Card>
  );
}

function Categories() {
  const categories = useCategories();
  const [name, setName] = useState('');
  return (
    <Card title="Kategorie" icon={<Sparkles size={15} />}>
      {categories.map((c) => (
        <CategoryRow key={c.id} c={c} />
      ))}
      <form
        className="flex items-center gap-3 px-4 py-2.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await createCategory(name);
          setName('');
        }}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-muted">
          <Plus size={16} />
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nowa kategoria"
          className="h-10 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-faint"
        />
        {name.trim() && (
          <button className="btn btn-primary h-9 px-3.5 text-sm" type="submit">
            Dodaj
          </button>
        )}
      </form>
    </Card>
  );
}

function CategoryRow({ c }: { c: Category }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(c.name);
  const hex = CATEGORY_COLORS[c.color].hex;
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <button
        ref={ref}
        onClick={() => setOpen(true)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-transform active:scale-90"
        style={{ background: `${hex}26` }}
        aria-label="Zmień kolor"
      >
        <span className="h-3.5 w-3.5 rounded-full" style={{ background: hex }} />
      </button>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== c.name && updateCategory(c.id, { name: name.trim() })}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-10 min-w-0 flex-1 bg-transparent text-[0.9375rem] font-medium outline-none"
      />
      <button
        className="icon-btn h-9 w-9 text-faint hover:text-danger"
        aria-label={`Usuń kategorię ${c.name}`}
        onClick={async () => {
          await deleteCategory(c.id);
          toast({ message: `Usunięto kategorię „${c.name}”`, tone: 'danger' });
        }}
      >
        <Trash size={16} />
      </button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} width={224} align="start">
        <div className="grid grid-cols-6 gap-1.5 p-2">
          {CATEGORY_COLOR_KEYS.map((k) => (
            <button
              key={k}
              title={CATEGORY_COLORS[k].label}
              onClick={() => {
                updateCategory(c.id, { color: k });
                setOpen(false);
              }}
              className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${k === c.color ? 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]' : ''}`}
              style={{ background: CATEGORY_COLORS[k].hex }}
            />
          ))}
        </div>
      </Popover>
    </div>
  );
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const setSettings = useSettings((s) => s.set);

  const onFile = async (file: File) => {
    try {
      const data = parseBackup(await file.text());
      setPending(data);
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'danger' });
    }
  };

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const res = await importBackup(pending, mode);
    if (pending.settings && mode === 'replace') {
      const { theme, weekStartsOn, loudAlarms, soundEnabled, allDayAlarmTime, defaultDurationMin } = pending.settings as Record<string, never>;
      setSettings({ theme, weekStartsOn, loudAlarms, soundEnabled, allDayAlarmTime, defaultDurationMin });
    }
    setPending(null);
    toast({ message: `Zaimportowano ${res.reminders} przypomnień i ${res.categories} kategorii`, tone: 'success' });
  };

  return (
    <Card
      title="Dane i kopia zapasowa"
      icon={<Database size={15} />}
      description="Dane są zapisywane lokalnie na tym urządzeniu. Aby przenieść je między telefonem a przeglądarką, wyeksportuj kopię i zaimportuj ją na drugim urządzeniu."
    >
      <SettingRow label="Eksportuj do JSON" hint="Pełna kopia przypomnień, kategorii i ustawień">
        <button
          className="btn btn-ghost h-10 text-sm"
          onClick={async () => {
            try {
              toast({ message: await exportBackup(settingsSnapshot()), tone: 'success' });
            } catch (e) {
              toast({ message: `Nie udało się wyeksportować: ${(e as Error).message}`, tone: 'danger' });
            }
          }}
        >
          <Download size={16} /> Eksport
        </button>
      </SettingRow>
      <SettingRow label="Importuj z JSON" hint="Wczytaj wcześniej zapisaną kopię">
        <button className="btn btn-ghost h-10 text-sm" onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
      </SettingRow>
      <SettingRow label="Przykładowe dane" hint="Dodaj kilka przypomnień, żeby zobaczyć aplikację w akcji">
        <button
          className="btn btn-ghost h-10 text-sm"
          onClick={async () => {
            const n = await addDemoData();
            toast({ message: `Dodano ${n} przykładowych przypomnień`, tone: 'success' });
          }}
        >
          <Sparkles size={16} /> Dodaj
        </button>
      </SettingRow>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="Import kopii zapasowej" width="28rem">
        {pending && (
          <div className="space-y-4 pb-2">
            <p className="text-[0.9375rem] text-ink-2">
              W pliku: <b>{pending.reminders.length}</b> przypomnień i <b>{pending.categories.length}</b> kategorii
              {pending.exportedAt && <> (z {new Date(pending.exportedAt).toLocaleString('pl-PL')})</>}.
            </p>
            <div className="space-y-2">
              <MenuItem icon={<Plus size={17} />} onClick={() => doImport('merge')} hint="zalecane">
                Połącz z obecnymi danymi
              </MenuItem>
              <MenuItem icon={<Trash size={17} />} tone="danger" onClick={() => doImport('replace')}>
                Zastąp wszystko kopią
              </MenuItem>
            </div>
          </div>
        )}
      </Sheet>
    </Card>
  );
}

function About() {
  return (
    <Card title="Szybkie dodawanie – ściąga" icon={<Wand2 size={15} />}>
      <div className="grid gap-x-6 gap-y-2 px-4 py-4 text-[0.8125rem] sm:grid-cols-2">
        {[
          ['jutro 15:00 telefon', 'data i godzina'],
          ['w piątek o 8 wieczorem kino', 'dzień tygodnia, pora dnia'],
          ['za 2 godziny / za 3 dni', 'względnie'],
          ['15.12 / 3 stycznia', 'konkretna data'],
          ['co poniedziałek 9:30', 'powtarzanie (też: codziennie, w dni robocze, co 2 tygodnie)'],
          ['13:00-14:30 / przez 45 min', 'czas trwania'],
          ['#praca', 'kategoria (nowa zostanie utworzona)'],
          ['! / !! / !n', 'priorytet wysoki / średni / niski'],
        ].map(([ex, desc]) => (
          <div key={ex}>
            <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-semibold text-ink">{ex}</code>
            <div className="mt-0.5 text-muted">{desc}</div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 text-[0.8125rem] text-muted">
        YoulllBproductive {__APP_VERSION__} · skróty: <kbd className="font-semibold">N</kbd> nowe, <kbd className="font-semibold">1–4</kbd>{' '}
        ekrany, <kbd className="font-semibold">/</kbd> szukaj
      </div>
    </Card>
  );
}
