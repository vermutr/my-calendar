import { useEffect, useState, type FormEvent } from 'react';
import { fullDate, isoWeekday } from '../lib/dates';
import type { EditScope, ISODate, Repeat, RepeatType, Task } from '../types';

interface Props {
  task: Task;
  /** День, по которому кликнули (для серии отличается от даты её начала) */
  occurrenceDate: ISODate;
  isNew: boolean;
  onSave: (task: Task, scope: EditScope) => void;
  onDelete: (scope: EditScope) => void;
  onClose: () => void;
}

const COLORS = ['#4f7cff', '#22a06b', '#e5484d', '#f59e0b', '#8b5cf6', '#0ea5b7', '#64748b'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WORKDAYS = [1, 2, 3, 4, 5];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none', label: 'Не повторять' },
  { value: 'weekdays', label: 'По дням недели' },
  { value: 'days', label: 'Каждые N дней' },
  { value: 'weeks', label: 'Каждые N недель' },
  { value: 'monthly', label: 'Каждый месяц' },
];

export function TaskModal({ task, occurrenceDate, isNew, onSave, onDelete, onClose }: Props) {
  const isSeries = !isNew && task.repeat.type !== 'none';
  const [scope, setScope] = useState<EditScope>(isSeries ? 'one' : 'series');

  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(isSeries ? occurrenceDate : task.date);
  const [timed, setTimed] = useState(Boolean(task.start));
  const [start, setStart] = useState(task.start ?? '09:00');
  const [end, setEnd] = useState(task.end ?? '');
  const [color, setColor] = useState(task.color);
  const [note, setNote] = useState(task.note ?? '');
  const [repeatType, setRepeatType] = useState<RepeatType>(task.repeat.type);
  const [days, setDays] = useState<number[]>(task.repeat.days ?? [isoWeekday(task.date)]);
  const [interval, setIntervalValue] = useState(task.repeat.interval ?? 2);
  const [until, setUntil] = useState(task.repeat.until ?? '');
  const [error, setError] = useState('');

  const editingOne = isSeries && scope === 'one';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function changeScope(next: EditScope) {
    setScope(next);
    setDate(next === 'one' ? occurrenceDate : task.date);
  }

  function buildRepeat(): Repeat {
    if (editingOne || repeatType === 'none') return { type: 'none' };
    const repeat: Repeat = { type: repeatType };
    if (repeatType === 'weekdays') repeat.days = [...days].sort();
    if (repeatType === 'days' || repeatType === 'weeks') repeat.interval = Math.max(1, interval);
    if (until) repeat.until = until;
    return repeat;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Введите название');
    if (!date) return setError('Укажите дату');
    if (timed && end && end <= start) return setError('Конец должен быть позже начала');
    if (!editingOne && repeatType === 'weekdays' && days.length === 0) {
      return setError('Выберите хотя бы один день недели');
    }
    if (!editingOne && until && until < date) return setError('Дата окончания раньше начала');

    onSave(
      {
        ...task,
        title: title.trim(),
        date,
        start: timed ? start : undefined,
        end: timed && end ? end : undefined,
        color,
        note: note.trim() || undefined,
        repeat: buildRepeat(),
      },
      scope,
    );
  }

  const toggleDay = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{isNew ? 'Новая задача' : 'Задача'}</h2>
          <button type="button" className="btn icon ghost" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {isSeries && (
          <div className="scope">
            <div className="segmented wide" role="group" aria-label="Что менять">
              <button type="button" className={scope === 'one' ? 'active' : ''} onClick={() => changeScope('one')}>
                Только этот день
              </button>
              <button type="button" className={scope === 'series' ? 'active' : ''} onClick={() => changeScope('series')}>
                Вся серия
              </button>
            </div>
            <p className="hint">
              {scope === 'one'
                ? `Изменения и удаление коснутся только ${fullDate(occurrenceDate)}.`
                : 'Изменения и удаление коснутся всех повторений.'}
            </p>
          </div>
        )}

        <input
          className="title-input"
          placeholder="Что нужно сделать?"
          aria-label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={isNew}
        />

        <div className="field-row">
          <label className="field">
            <span>{!editingOne && repeatType !== 'none' ? 'Начало серии' : 'Дата'}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field checkbox-field">
            <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
            <span>Со временем</span>
          </label>
        </div>

        {timed && (
          <div className="field-row">
            <label className="field">
              <span>Начало</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label className="field">
              <span>Конец</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
        )}

        {!editingOne && (
          <>
            <label className="field">
              <span>Повторение</span>
              <select value={repeatType} onChange={(e) => setRepeatType(e.target.value as RepeatType)}>
                {REPEAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {repeatType === 'weekdays' && (
              <div className="weekday-picker">
                <div className="weekday-buttons">
                  {WEEKDAYS.map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      className={days.includes(i + 1) ? 'active' : ''}
                      aria-pressed={days.includes(i + 1)}
                      onClick={() => toggleDay(i + 1)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="presets">
                  <button type="button" onClick={() => setDays(ALL_DAYS)}>
                    каждый день
                  </button>
                  <button type="button" onClick={() => setDays(WORKDAYS)}>
                    будни
                  </button>
                </div>
              </div>
            )}

            {(repeatType === 'days' || repeatType === 'weeks') && (
              <label className="field inline">
                <span>Каждые</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={interval}
                  onChange={(e) => setIntervalValue(Number(e.target.value))}
                />
                <span>{repeatType === 'days' ? 'дн.' : 'нед.'}</span>
              </label>
            )}

            {repeatType === 'monthly' && date && (
              <p className="hint">
                Каждый месяц {Number(date.slice(8))}-го числа
                {Number(date.slice(8)) > 28 && ' (в коротких месяцах — в последний день)'}.
              </p>
            )}

            {repeatType !== 'none' && (
              <label className="field">
                <span>Повторять до (необязательно)</span>
                <input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} />
              </label>
            )}
          </>
        )}

        <div className="field">
          <span>Цвет</span>
          <div className="colors">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color ${c === color ? 'active' : ''}`}
                style={{ background: c }}
                aria-label={`Цвет ${c}`}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <label className="field">
          <span>Заметка</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          {!isNew && (
            <button type="button" className="btn danger" onClick={() => onDelete(scope)}>
              {isSeries ? (scope === 'one' ? 'Удалить этот день' : 'Удалить серию') : 'Удалить'}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary">Сохранить</button>
        </div>
      </form>
    </div>
  );
}
