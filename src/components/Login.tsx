import { useState, type FormEvent } from 'react';
import { login, UnauthorizedError } from '../lib/api';

interface Props {
  onLogin: (token: string) => void;
}

export function Login({ onLogin }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await login(password));
    } catch (err) {
      setError(err instanceof UnauthorizedError ? 'Неверный пароль' : 'Сервер недоступен, попробуйте ещё раз');
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-icon" aria-hidden>
          🗓️
        </div>
        <h1>Календарь</h1>
        <input
          type="password"
          placeholder="Пароль"
          aria-label="Пароль"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary" disabled={busy || !password}>
          {busy ? 'Проверяю…' : 'Войти'}
        </button>
      </form>
    </main>
  );
}
