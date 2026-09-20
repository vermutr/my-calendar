import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchData, saveData, UnauthorizedError } from '../lib/api';
import type { CalendarData } from '../types';

export const CACHE_KEY = 'calendar:cache';
const SAVE_DELAY_MS = 800;
const EMPTY: CalendarData = { tasks: [], done: {}, updatedAt: 0 };

interface Cache {
  data: CalendarData;
  /** Есть изменения, которые ещё не доехали до сервера */
  dirty: boolean;
}

export type SyncStatus = 'loading' | 'saving' | 'saved' | 'error';

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

function writeCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // приватный режим или переполнение — работаем без кэша
  }
}

export function useCalendarData(token: string, onUnauthorized: () => void) {
  const [initial] = useState(readCache);
  const [data, setData] = useState<CalendarData>(initial?.data ?? EMPTY);
  const [status, setStatus] = useState<SyncStatus>('loading');

  const dataRef = useRef(data);
  const dirtyRef = useRef(initial?.dirty ?? false);
  const savingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof UnauthorizedError) onUnauthorized();
      else setStatus('error');
    },
    [onUnauthorized],
  );

  const push = useCallback(async () => {
    if (savingRef.current) return; // текущая отправка сама подхватит свежие данные
    savingRef.current = true;
    setStatus('saving');
    try {
      let snapshot: CalendarData;
      do {
        snapshot = dataRef.current;
        await saveData(token, snapshot);
      } while (dataRef.current !== snapshot);
      dirtyRef.current = false;
      writeCache({ data: snapshot, dirty: false });
      setStatus('saved');
    } catch (e) {
      fail(e);
    } finally {
      savingRef.current = false;
    }
  }, [token, fail]);

  const pull = useCallback(async () => {
    if (dirtyRef.current) return push();
    try {
      const remote = await fetchData(token);
      if (dirtyRef.current) return; // пока грузили, пользователь что-то изменил
      dataRef.current = remote;
      setData(remote);
      writeCache({ data: remote, dirty: false });
      setStatus('saved');
    } catch (e) {
      fail(e);
    }
  }, [token, push, fail]);

  useEffect(() => {
    void pull();
    // вернулись на вкладку — подтягиваем изменения с других устройств
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [pull]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const update = useCallback(
    (fn: (current: CalendarData) => CalendarData) => {
      const next = { ...fn(dataRef.current), updatedAt: Date.now() };
      dataRef.current = next;
      dirtyRef.current = true;
      setData(next);
      writeCache({ data: next, dirty: true });
      setStatus('saving');
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void push(), SAVE_DELAY_MS);
    },
    [push],
  );

  return { data, status, update, retry: push };
}
