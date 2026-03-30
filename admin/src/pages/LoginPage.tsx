import React, { useState } from 'react';
import axios from 'axios';
import { AdminAuthSession } from '../auth';
import { API_URL } from '../api/config';

interface Props {
  onLoggedIn(session: AdminAuthSession): void;
}

export const LoginPage: React.FC<Props> = ({ onLoggedIn }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        phone,
        password,
      });
      const { accessToken, refreshToken, user } = response.data;
      if (user.role !== 'ADMIN') {
        setError('Только пользователи с ролью ADMIN могут войти в админ‑панель.');
        return;
      }
      onLoggedIn({ accessToken, refreshToken });
    } catch {
      setError('Ошибка входа. Проверьте данные.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>TaxiVillage Admin</h1>
        <p>Войдите под администраторской учётной записью.</p>
        <input
          className="input"
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          type="password"
          className="input"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="error">{error}</div>}
        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
    </div>
  );
};

