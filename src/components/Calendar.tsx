import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useCalendarData, type SyncStatus } from '../hooks/useCalendarData';
import { addDays, fullDate, startOfWeek, todayISO, weekLabel } from '../lib/dates';
import { getOccurrences } from '../lib/recurrence';
import type { CalendarData, EditScope, HHMM, ISODate, Occurrence, Task } from '../types';
import { TaskModal } from './TaskModal';
import { WeekGrid } from './WeekGrid';

interface Props {
  token: string;
  onExpired: () => void;
  onLogout: () => void;
}

type View = 'week' | 'day';

interface Editing {
  task: Task;
  date: ISODate;
  isNew: boolean;
}

const DEFAULT_COLOR = '#4f7cff';

const STATUS_TEXT: Record<SyncStatus, string> = {
  loading: 'Загрузка…',
  saving: 'Сохраняю…',
  saved: 'Сохранено',
  error: 'Не сохранено — повторить',
};

const isNarrow = () => window.matchMedia('(max-width: 720px)').matches;

function toggleIn(list: string[] | undefined, value: string): string[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function Calendar({ token, onExpired, onLogout }: Props) {
  const { data, status, update, retry } = useCalendarData(token, onExpired);
  const [view, setView] = useState<View>(() => (isNarrow() ? 'day' : 'week'));
  const [anchor, setAnchor] = useState<ISODate>(todayISO);
  const [editing, setEditing] = useState<Editing | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const from = view === 'week' ? startOfWeek(anchor) : anchor;
  const dayCount = view === 'week' ? 7 : 1;
  const occurrences = useMemo(
    () => getOccurrences(data.tasks, from, dayCount),
    [data.tasks, from, dayCount],
  );

  const shift = (dir: 1 | -1) => setAnchor((a) => addDays(a, dir * dayCount));

  function openNew(date: ISODate, start?: HHMM, end?: HHMM) {
    const task: Task = {
      id: crypto.randomUUID(),
      title: '',
      date,
      start,
      end,
      color: DEFAULT_COLOR,
      repeat: { type: 'none' },
    };
    setEditing({ task, date, isNew: true });
  }

  function toggleDone({ task, date }: Occurrence) {
    update((d) => ({ ...d, done: { ...d.done, [task.id]: toggleIn(d.done[task.id], date) } }));
  }

  function saveTask(task: Task, scope: EditScope) {
    if (!editing) return;
    const { task: original, date, isNew } = editing;
    update((d) => {
      if (isNew) return { ...d, tasks: [...d.tasks, task] };

      if (original.repeat.type !== 'none' && scope === 'one') {
        // Вырезаем день из серии и кладём на его место отдельную разовую задачу
        const single: Task = {
          ...task,
          id: crypto.randomUUID(),
          repeat: { type: 'none' },
          exceptions: undefined,
        };
        const done = { ...d.done };
        if (done[original.id]?.includes(date)) {
          done[original.id] = done[original.id].filter((x) => x !== date);
          done[single.id] = [single.date];
        }
        return {
          ...d,
          done,
          tasks: [
            ...d.tasks.map((t) =>
              t.id === original.id ? { ...t, exceptions: [...(t.exceptions ?? []), date] } : t,
            ),
            single,
          ],
        };
      }

      return { ...d, tasks: d.tasks.map((t) => (t.id === task.id ? task : t)) };
    });
    setEditing(null);
  }

  function deleteTask(scope: EditScope) {
    if (!editing) return;
    const { task: original, date } = editing;
    update((d) => {
      if (original.repeat.type !== 'none' && scope === 'one') {
        return {
          ...d,
          done: { ...d.done, [original.id]: (d.done[original.id] ?? []).filter((x) => x !== date) },
          tasks: d.tasks.map((t) =>
            t.id === original.id ? { ...t, exceptions: [...(t.exceptions ?? []), date] } : t,
          ),
        };
      }
      const done = { ...d.done };
      delete done[original.id];
      return { ...d, done, tasks: d.tasks.filter((t) => t.id !== original.id) };
    });
    setEditing(null);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `calendar-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as CalendarData;
      if (!Array.isArray(parsed.tasks) || typeof parsed.done !== 'object' || !parsed.done) {
        throw new Error('bad shape');
      }
      if (confirm(`Заменить все текущие данные содержимым файла (${parsed.tasks.length} задач)?`)) {
        update(() => parsed);
      }
    } catch {
      alert('Не удалось прочитать файл: это не бэкап календаря.');
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="nav">
          <button className="btn" onClick={() => setAnchor(todayISO())}>
            Сегодня
          </button>
          <button className="btn icon" onClick={() => shift(-1)} aria-label="Назад">
            ‹
          </button>
          <button className="btn icon" onClick={() => shift(1)} aria-label="Вперёд">
            ›
          </button>
        </div>
        <h1 className="period">{view === 'week' ? weekLabel(from) : fullDate(from)}</h1>
        <div className="actions">
          <button
            className={`sync sync-${status}`}
            onClick={status === 'error' ? () => void retry() : undefined}
            disabled={status !== 'error'}
          >
            {STATUS_TEXT[status]}
          </button>
          <div className="segmented" role="group" aria-label="Вид">
            <button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>
              День
            </button>
            <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>
              Неделя
            </button>
          </div>
          <button className="btn primary" onClick={() => openNew(view === 'day' ? anchor : todayISO())}>
            + Задача
          </button>
          <details className="menu">
            <summary className="btn icon" aria-label="Меню">
              ⋯
            </summary>
            <div className="menu-list">
              <button onClick={exportBackup}>Скачать бэкап JSON</button>
              <button onClick={() => fileRef.current?.click()}>Восстановить из файла</button>
              <button onClick={onLogout}>Выйти</button>
            </div>
          </details>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
        </div>
      </header>

      <WeekGrid
        days={dayCount}
        from={from}
        occurrences={occurrences}
        done={data.done}
        onCreate={openNew}
        onOpen={({ task, date }) => setEditing({ task, date, isNew: false })}
        onToggle={toggleDone}
        onPickDay={(date) => {
          setAnchor(date);
          setView('day');
        }}
      />

      {editing && (
        <TaskModal
          key={editing.task.id + editing.date}
          task={editing.task}
          occurrenceDate={editing.date}
          isNew={editing.isNew}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
