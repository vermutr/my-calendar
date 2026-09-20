import type { ISODate, Occurrence, Repeat, Task } from '../types';
import { dayOfMonth, daysInMonth, diffDays, isoWeekday, range } from './dates';

export function occursOn(task: Task, date: ISODate): boolean {
  const { repeat } = task;
  if (repeat.type === 'none') return date === task.date;

  if (date < task.date) return false;
  if (repeat.until && date > repeat.until) return false;
  if (task.exceptions?.includes(date)) return false;

  const interval = Math.max(1, repeat.interval ?? 1);
  switch (repeat.type) {
    case 'weekdays':
      return (repeat.days ?? []).includes(isoWeekday(date));
    case 'days':
      return diffDays(date, task.date) % interval === 0;
    case 'weeks':
      return diffDays(date, task.date) % (7 * interval) === 0;
    case 'monthly':
      // 31-е число в коротком месяце попадает на его последний день
      return dayOfMonth(date) === Math.min(dayOfMonth(task.date), daysInMonth(date));
  }
}

export function getOccurrences(tasks: Task[], from: ISODate, days: number): Occurrence[] {
  const result: Occurrence[] = [];
  for (const date of range(from, days)) {
    for (const task of tasks) {
      if (occursOn(task, date)) result.push({ task, date });
    }
  }
  return result;
}

const WEEKDAY_NAMES = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export function describeRepeat(repeat: Repeat): string {
  const n = Math.max(1, repeat.interval ?? 1);
  switch (repeat.type) {
    case 'none':
      return '';
    case 'weekdays': {
      const days = [...(repeat.days ?? [])].sort();
      if (days.length === 7) return 'каждый день';
      if (days.join() === '1,2,3,4,5') return 'по будням';
      return days.map((d) => WEEKDAY_NAMES[d - 1]).join(', ');
    }
    case 'days':
      return n === 1 ? 'каждый день' : `раз в ${n} дн.`;
    case 'weeks':
      return n === 1 ? 'каждую неделю' : `раз в ${n} нед.`;
    case 'monthly':
      return 'каждый месяц';
  }
}
