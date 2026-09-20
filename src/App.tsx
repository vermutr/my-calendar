import { useCallback, useState } from 'react';
import { Calendar } from './components/Calendar';
import { Login } from './components/Login';
import { CACHE_KEY } from './hooks/useCalendarData';

const TOKEN_KEY = 'calendar:token';

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  const handleLogin = useCallback((next: string) => {
    localStorage.setItem(TOKEN_KEY, next);
    setToken(next);
  }, []);

  // Токен протух или сменили пароль: кэш не трогаем, чтобы не потерять несохранённое
  const handleExpired = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CACHE_KEY);
    setToken(null);
  }, []);

  if (!token) return <Login onLogin={handleLogin} />;
  return <Calendar token={token} onExpired={handleExpired} onLogout={handleLogout} />;
}
