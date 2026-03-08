import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Props {
  token: string;
  onLogout(): void;
}

interface User {
  id: string;
  phone: string;
  role: string;
}

interface Ride {
  id: string;
  status: string;
  fromAddress: string;
  toAddress: string;
}

type Tab = 'users' | 'drivers' | 'rides';

export const DashboardPage: React.FC<Props> = ({ token, onLogout }) => {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    const client = axios.create({
      baseURL: API_URL,
      headers: { Authorization: `Bearer ${token}` },
    });

    const load = async () => {
      if (tab === 'users') {
        const res = await client.get('/admin/users');
        setUsers(res.data);
      }
      if (tab === 'rides') {
        const res = await client.get('/admin/rides');
        setRides(res.data);
      }
    };

    load().catch(() => {
      // ignore for MVP
    });
  }, [tab, token]);

  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="sidebar-title">TaxiVillage Admin</div>
        <div className="sidebar-nav">
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            Пользователи
          </button>
          <button className={tab === 'drivers' ? 'active' : ''} onClick={() => setTab('drivers')}>
            Водители
          </button>
          <button className={tab === 'rides' ? 'active' : ''} onClick={() => setTab('rides')}>
            Поездки
          </button>
        </div>
        <button className="button" style={{ marginTop: 'auto' }} onClick={onLogout}>
          Выйти
        </button>
      </aside>

      <main className="content">
        {tab === 'users' && (
          <section className="card">
            <h2>Пользователи</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Телефон</th>
                  <th>Роль</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.phone}</td>
                    <td>{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'rides' && (
          <section className="card">
            <h2>Поездки</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Статус</th>
                  <th>Откуда</th>
                  <th>Куда</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id.slice(0, 6)}…</td>
                    <td>{r.status}</td>
                    <td>{r.fromAddress}</td>
                    <td>{r.toAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'drivers' && (
          <section className="card">
            <h2>Водители</h2>
            <p>Просмотр и модерация водителей может быть добавлена здесь (API уже предоставляет данные).</p>
          </section>
        )}
      </main>
    </div>
  );
};

