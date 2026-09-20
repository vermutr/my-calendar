import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { dayOfMonth, fromMinutes, range, todayISO, toMinutes, weekdayShort } from '../lib/dates';
import { layoutDay } from '../lib/layout';
import { describeRepeat } from '../lib/recurrence';
import type { CalendarData, HHMM, ISODate, Occurrence } from '../types';

interface Props {
  from: ISODate;
  days: number;
  occurrences: Occurrence[];
  done: CalendarData['done'];
  onCreate: (date: ISODate, start?: HHMM, end?: HHMM) => void;
  onOpen: (occurrence: Occurrence) => void;
  onToggle: (occurrence: Occurrence) => void;
  onPickDay: (date: ISODate) => void;
}

const HOUR_PX = 52;
const SLOT_MIN = 30;
const DEFAULT_DURATION_MIN = 30;
const MIN_EVENT_PX = 24;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

interface CheckProps {
  checked: boolean;
  onToggle: () => void;
}

function Check({ checked, onToggle }: CheckProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? 'Снять отметку' : 'Отметить выполненной'}
      className={`check ${checked ? 'checked' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {checked && '✓'}
    </button>
  );
}

export function WeekGrid({ from, days, occurrences, done, onCreate, onOpen, onToggle, onPickDay }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = useNow();
  const today = todayISO();
  const dates = useMemo(() => range(from, days), [from, days]);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // При открытии показываем утро (или текущее время), а не полночь
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(0, (Math.min(nowMinutes, 8 * 60) / 60 - 1) * HOUR_PX - 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<ISODate, { allDay: Occurrence[]; timed: Occurrence[] }>();
    for (const date of dates) map.set(date, { allDay: [], timed: [] });
    for (const occ of occurrences) {
      const bucket = map.get(occ.date);
      if (bucket) (occ.task.start ? bucket.timed : bucket.allDay).push(occ);
    }
    return map;
  }, [dates, occurrences]);

  const isDone = (o: Occurrence) => done[o.task.id]?.includes(o.date) ?? false;

  function handleColumnClick(e: MouseEvent<HTMLDivElement>, date: ISODate) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = ((e.clientY - rect.top) / HOUR_PX) * 60;
    const start = Math.min(Math.floor(minutes / SLOT_MIN) * SLOT_MIN, 23 * 60);
    onCreate(date, fromMinutes(start), fromMinutes(start + 60));
  }

  const columns = { '--days': days } as CSSProperties;

  return (
    <div className="week" ref={scrollRef} style={columns}>
      <div className="week-sticky">
        <div className="week-row week-head">
          <div className="gutter" />
          {dates.map((date) => {
            const all = [...byDate.get(date)!.allDay, ...byDate.get(date)!.timed];
            const doneCount = all.filter(isDone).length;
            return (
              <button
                key={date}
                className={`day-head ${date === today ? 'today' : ''}`}
                onClick={() => onPickDay(date)}
                title="Открыть день"
              >
                <span className="day-name">{weekdayShort(date)}</span>
                <span className="day-num">{dayOfMonth(date)}</span>
                {all.length > 0 && (
                  <span className={`day-count ${doneCount === all.length ? 'complete' : ''}`}>
                    {doneCount}/{all.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="week-row allday">
          <div className="gutter gutter-label">весь день</div>
          {dates.map((date) => (
            <div key={date} className="allday-cell" onClick={() => onCreate(date)}>
              {byDate.get(date)!.allDay.map((occ) => (
                <div
                  key={occ.task.id}
                  className={`chip ${isDone(occ) ? 'done' : ''}`}
                  style={{ '--color': occ.task.color } as CSSProperties}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(occ);
                  }}
                >
                  <Check checked={isDone(occ)} onToggle={() => onToggle(occ)} />
                  <span className="event-title">{occ.task.title}</span>
                  {occ.task.repeat.type !== 'none' && <span className="repeat-mark">↻</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="week-row grid" style={{ height: HOUR_PX * 24 }}>
        <div className="gutter hours">
          {HOURS.map((h) => (
            <span key={h} style={{ top: h * HOUR_PX }}>
              {h > 0 && `${String(h).padStart(2, '0')}:00`}
            </span>
          ))}
        </div>

        {dates.map((date) => {
          const spans = byDate.get(date)!.timed.map((occ) => {
            const start = toMinutes(occ.task.start!);
            const rawEnd = occ.task.end ? toMinutes(occ.task.end) : start + DEFAULT_DURATION_MIN;
            return { occ, start, end: Math.max(rawEnd, start + 15) };
          });
          return (
            <div
              key={date}
              className={`daycol ${date === today ? 'today' : ''}`}
              style={{ '--hour': `${HOUR_PX}px` } as CSSProperties}
              onClick={(e) => handleColumnClick(e, date)}
            >
              {layoutDay(spans).map(({ item, column, columns: total }) => {
                const { occ, start, end } = item;
                const height = Math.max(((end - start) / 60) * HOUR_PX, MIN_EVENT_PX);
                const repeat = describeRepeat(occ.task.repeat);
                return (
                  <div
                    key={occ.task.id}
                    className={`event ${isDone(occ) ? 'done' : ''} ${height < 44 ? 'compact' : ''}`}
                    style={
                      {
                        '--color': occ.task.color,
                        top: (start / 60) * HOUR_PX,
                        height,
                        left: `${(column / total) * 100}%`,
                        width: `${100 / total}%`,
                      } as CSSProperties
                    }
                    title={[occ.task.title, repeat, occ.task.note].filter(Boolean).join('\n')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(occ);
                    }}
                  >
                    <Check checked={isDone(occ)} onToggle={() => onToggle(occ)} />
                    <div className="event-body">
                      <span className="event-title">{occ.task.title}</span>
                      <span className="event-time">
                        {occ.task.start}
                        {occ.task.end && `–${occ.task.end}`}
                        {repeat && ' ↻'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {date === today && <div className="now-line" style={{ top: (nowMinutes / 60) * HOUR_PX }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
