import { describe, expect, it } from 'vitest';
import type { Repeat, Task } from '../types';
import { isoWeekday, startOfWeek, weekLabel } from './dates';
import { layoutDay } from './layout';
import { getOccurrences, occursOn } from './recurrence';

const task = (date: string, repeat: Repeat, extra: Partial<Task> = {}): Task => ({
  id: 't',
  title: 'test',
  color: '#000',
  date,
  repeat,
  ...extra,
});

describe('dates', () => {
  it('knows weekdays and week starts', () => {
    expect(isoWeekday('2026-09-20')).toBe(7); // воскресенье
    expect(isoWeekday('2026-09-21')).toBe(1);
    expect(startOfWeek('2026-09-20')).toBe('2026-09-14');
    expect(startOfWeek('2026-09-14')).toBe('2026-09-14');
  });

  it('builds week labels', () => {
    expect(weekLabel('2026-09-14')).toBe('14–20 сентября 2026');
    expect(weekLabel('2026-09-28')).toContain('2026');
  });
});

describe('occursOn', () => {
  it('one-off task occurs only on its date', () => {
    const t = task('2026-09-20', { type: 'none' });
    expect(occursOn(t, '2026-09-20')).toBe(true);
    expect(occursOn(t, '2026-09-21')).toBe(false);
  });

  it('weekdays: only chosen days, not before start', () => {
    const t = task('2026-09-16', { type: 'weekdays', days: [1, 3, 5] });
    expect(occursOn(t, '2026-09-14')).toBe(false); // пн, но до начала
    expect(occursOn(t, '2026-09-16')).toBe(true); // ср
    expect(occursOn(t, '2026-09-17')).toBe(false); // чт
    expect(occursOn(t, '2026-09-18')).toBe(true); // пт
    expect(occursOn(t, '2026-09-21')).toBe(true); // пн
  });

  it('every N days', () => {
    const t = task('2026-09-01', { type: 'days', interval: 3 });
    expect(occursOn(t, '2026-09-04')).toBe(true);
    expect(occursOn(t, '2026-09-05')).toBe(false);
    expect(occursOn(t, '2026-10-01')).toBe(true); // +30 дней
  });

  it('every N weeks survives DST and year boundaries', () => {
    const t = task('2026-10-19', { type: 'weeks', interval: 2 });
    expect(occursOn(t, '2026-10-26')).toBe(false);
    expect(occursOn(t, '2026-11-02')).toBe(true);
    expect(occursOn(t, '2027-01-11')).toBe(true); // +12 недель
  });

  it('monthly clamps to the last day of short months', () => {
    const t = task('2026-01-31', { type: 'monthly' });
    expect(occursOn(t, '2026-02-28')).toBe(true);
    expect(occursOn(t, '2026-02-27')).toBe(false);
    expect(occursOn(t, '2026-03-31')).toBe(true);
    expect(occursOn(t, '2026-04-30')).toBe(true);
    expect(occursOn(t, '2028-02-29')).toBe(true); // високосный
  });

  it('respects until and exceptions', () => {
    const t = task(
      '2026-09-01',
      { type: 'days', interval: 1, until: '2026-09-05' },
      { exceptions: ['2026-09-03'] },
    );
    expect(occursOn(t, '2026-09-02')).toBe(true);
    expect(occursOn(t, '2026-09-03')).toBe(false);
    expect(occursOn(t, '2026-09-05')).toBe(true);
    expect(occursOn(t, '2026-09-06')).toBe(false);
  });
});

describe('getOccurrences', () => {
  it('expands a week', () => {
    const daily = task('2026-09-16', { type: 'weekdays', days: [1, 2, 3, 4, 5, 6, 7] });
    const dates = getOccurrences([daily], '2026-09-14', 7).map((o) => o.date);
    expect(dates).toEqual(['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']);
  });
});

describe('layoutDay', () => {
  it('puts overlapping items side by side and resets after a gap', () => {
    const a = { start: 60, end: 120 };
    const b = { start: 90, end: 150 };
    const c = { start: 120, end: 180 }; // пересекается с b, но не с a
    const d = { start: 300, end: 360 };
    const placed = layoutDay([a, b, c, d]);
    const of = (x: object) => placed.find((p) => p.item === x)!;
    expect(of(a)).toMatchObject({ column: 0, columns: 2 });
    expect(of(b)).toMatchObject({ column: 1, columns: 2 });
    expect(of(c)).toMatchObject({ column: 0, columns: 2 });
    expect(of(d)).toMatchObject({ column: 0, columns: 1 });
  });
});
