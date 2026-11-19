import { useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Minus, Plus, RotateCcw, Trash } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { uuid } from '../lib/ids';
import { haptic } from '../lib/platform';

interface Counter {
  id: string;
  name: string;
  value: number;
}

interface CountersState {
  counters: Counter[];
  add: (name: string) => void;
  change: (id: string, delta: number) => void;
  rename: (id: string, name: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

const useCounters = create<CountersState>()(
  persist(
    (set) => {
      const map = (id: string, fn: (c: Counter) => Counter) => set((s) => ({ counters: s.counters.map((c) => (c.id === id ? fn(c) : c)) }));
      return {
        counters: [],
        add: (name) => set((s) => ({ counters: [...s.counters, { id: uuid(), name: name.trim() || `Licznik ${s.counters.length + 1}`, value: 0 }] })),
        change: (id, d) => map(id, (c) => ({ ...c, value: Math.max(0, c.value + d) })),
        rename: (id, name) => map(id, (c) => ({ ...c, name })),
        reset: (id) => map(id, (c) => ({ ...c, value: 0 })),
        remove: (id) => set((s) => ({ counters: s.counters.filter((c) => c.id !== id) })),
      };
    },
    { name: 'ybp-counters' },
  ),
);

export function CountersScreen() {
  const { counters, add, change, rename, reset, remove } = useCounters();
  const [name, setName] = useState('');

  return (
    <div className="mx-auto max-w-2xl">
      <ScreenHeader title="Liczniki" />
      <div className="space-y-3 px-3 pb-10 sm:px-5 lg:px-8">
        <form
          className="card flex items-center gap-2 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            add(name);
            setName('');
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nazwa nowego licznika"
            className="h-11 min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-faint"
          />
          <button className="btn btn-primary h-11" type="submit">
            <Plus size={18} /> Dodaj
          </button>
        </form>

        {!counters.length && <p className="px-3 py-8 text-center text-muted">Dodaj pierwszy licznik powyżej.</p>}

        {counters.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-center gap-1">
              <input
                value={c.name}
                onChange={(e) => rename(c.id, e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
                aria-label="Nazwa licznika"
              />
              <button className="icon-btn" onClick={() => reset(c.id)} aria-label="Wyzeruj">
                <RotateCcw size={18} />
              </button>
              <button className="icon-btn text-danger" onClick={() => confirm(`Usunąć „${c.name}”?`) && remove(c.id)} aria-label="Usuń">
                <Trash size={18} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button className="btn btn-ghost h-16 w-16 rounded-2xl px-0" onClick={() => change(c.id, -1)} aria-label="Minus">
                <Minus size={24} />
              </button>
              <button
                className="tnum h-16 flex-1 rounded-2xl bg-accent font-display text-4xl font-bold text-white active:scale-[0.98] dark:text-[#0b0d12]"
                onClick={() => {
                  change(c.id, 1);
                  haptic('light');
                }}
              >
                {c.value}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
