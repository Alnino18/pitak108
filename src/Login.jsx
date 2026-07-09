import { useState } from 'react';
import { useAuth } from './AuthContext';

const AVATARS = ['🂡', '🃁', '🃑', '🂱', '🎴', '🀄'];

export default function Login() {
  const { register, login } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) throw new Error('Введите имя');
        await register(email, password, name.trim(), avatar);
      }
    } catch (err) {
      setError(translateError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <h1 className="brand">Акопчила 108</h1>
      <p className="brand-sub">приватный стол для своих</p>

      <div className="auth-tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
          Вход
        </button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">
          Регистрация
        </button>
      </div>

      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && (
          <>
            <input placeholder="Ваше имя" value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="avatar-picker">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`avatar-choice ${avatar === a ? 'chosen' : ''}`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </>
        )}
        <input
          type="email"
          placeholder="Почта"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit" disabled={busy}>
          {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
      </form>
    </div>
  );
}

function translateError(err) {
  const code = err?.code || '';
  if (code.includes('email-already-in-use')) return 'Такая почта уже зарегистрирована';
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Неверная почта или пароль';
  if (code.includes('weak-password')) return 'Пароль слишком короткий (минимум 6 символов)';
  if (code.includes('user-not-found')) return 'Пользователь не найден';
  return err.message || 'Что-то пошло не так';
}
