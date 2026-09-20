import type { HHMM, ISODate } from '../types';

// Все вычисления идут по номеру дня в UTC — так переходы на летнее время ничего не ломают.
const DAY_MS = 86_400_000;

export function dayNumber(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function fromDayNumber(n: number): ISODate {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function toISO(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const todayISO = (): ISODate => toISO(new Date());

export const addDays = (iso: ISODate, n: number): ISODate => fromDayNumber(dayNumber(iso) + n);

export const diffDays = (a: ISODate, b: ISODate): number => dayNumber(a) - dayNumber(b);

/** 1 = пн … 7 = вс */
export function isoWeekday(iso: ISODate): number {
  const js = new Date(dayNumber(iso) * DAY_MS).getUTCDay();
  return js === 0 ? 7 : js;
}

export const startOfWeek = (iso: ISODate): ISODate => addDays(iso, 1 - isoWeekday(iso));

export function daysInMonth(iso: ISODate): number {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const dayOfMonth = (iso: ISODate): number => Number(iso.slice(8, 10));

export function range(from: ISODate, count: number): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

export function toMinutes(time: HHMM): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): HHMM {
  const clamped = Math.max(0, Math.min(min, 23 * 60 + 59));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function fmt(iso: ISODate, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'UTC' }).format(
    new Date(dayNumber(iso) * DAY_MS),
  );
}

export const weekdayShort = (iso: ISODate) => fmt(iso, { weekday: 'short' });
export const fullDate = (iso: ISODate) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });

export function weekLabel(from: ISODate): string {
  const to = addDays(from, 6);
  const year = to.slice(0, 4);
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return `${dayOfMonth(from)}–${fmt(to, { day: 'numeric', month: 'long' })} ${year}`;
  }
  return `${fmt(from, { day: 'numeric', month: 'short' })} – ${fmt(to, { day: 'numeric', month: 'short' })} ${year}`;
}
