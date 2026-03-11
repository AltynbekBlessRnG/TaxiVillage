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

interface DriverDocument {
  id: string;
  type: string;
  url: string;
  approved: boolean;
}

interface Car {
  id: string;
  make: string;
  model: string;
  color: string;
  plateNumber: string;
}

interface Driver {
  id: string;
  fullName: string | null;
  status: string;
  isOnline: boolean;
  balance?: number | string;
  user: { id: string; phone: string; email?: string };
  car: Car | null;
  documents: DriverDocument[];
}

interface Tariff {
  id: string;
  name: string;
  baseFare: number | string;
  pricePerKm: number | string;
  pricePerMinute: number | string | null;
  isActive: boolean;
}

type Tab = 'overview' | 'users' | 'drivers' | 'rides' | 'tariffs';

interface Stats {
  totalRides: number;
  totalDrivers: number;
  totalRevenue: number;
}

export const DashboardPage: React.FC<Props> = ({ token, onLogout }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [tariffForm, setTariffForm] = useState<{
    name: string;
    baseFare: string;
    pricePerKm: string;
    pricePerMinute: string;
    isActive: boolean;
  } | null>(null);
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);
  const [tariffError, setTariffError] = useState<string | null>(null);

  const client = React.useMemo(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token],
  );

  const loadDrivers = React.useCallback(async () => {
    const res = await client.get('/admin/drivers');
    setDrivers(res.data);
  }, [client]);

  const loadTariffs = React.useCallback(async () => {
    const res = await client.get('/tariffs');
    setTariffs(res.data);
  }, [client]);

  const loadStats = React.useCallback(async () => {
    try {
      const [ridesRes, driversRes] = await Promise.all([
        client.get('/admin/rides'),
        client.get('/admin/drivers'),
      ]);
      const rides = ridesRes.data;
      const drivers = driversRes.data;
      const totalRevenue = rides.reduce((sum: number, ride: any) => sum + (ride.finalPrice || 0), 0);
      setStats({
        totalRides: rides.length,
        totalDrivers: drivers.length,
        totalRevenue,
      });
    } catch {
      // ignore
    }
  }, [client]);

  useEffect(() => {
    const load = async () => {
      if (tab === 'users') {
        const res = await client.get('/admin/users');
        setUsers(res.data);
      }
      if (tab === 'rides') {
        const res = await client.get('/admin/rides');
        setRides(res.data);
      }
      if (tab === 'drivers') {
        await loadDrivers();
      }
      if (tab === 'tariffs') {
        await loadTariffs();
      }
      if (tab === 'overview') {
        await loadStats();
      }
    };

    load().catch(() => {
      // ignore for MVP
    });
  }, [tab, client, loadDrivers, loadTariffs, loadStats]);

  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="sidebar-title">TaxiVillage Admin</div>
        <div className="sidebar-nav">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
            📊 Обзор
          </button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            👤 Пользователи
          </button>
          <button className={tab === 'drivers' ? 'active' : ''} onClick={() => setTab('drivers')}>
            🚗 Водители
          </button>
          <button className={tab === 'rides' ? 'active' : ''} onClick={() => setTab('rides')}>
            📍 Поездки
          </button>
          <button className={tab === 'tariffs' ? 'active' : ''} onClick={() => setTab('tariffs')}>
            💰 Тарифы
          </button>
        </div>
        <button className="button" style={{ marginTop: 'auto' }} onClick={onLogout}>
          Выйти
        </button>
      </aside>

      <main className="content">
        {tab === 'overview' && (
          <section>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon stat-icon-blue">📍</div>
                <div className="stat-content">
                  <p className="stat-value">{stats?.totalRides ?? '...'}</p>
                  <p className="stat-label">Всего поездок</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon-green">🚗</div>
                <div className="stat-content">
                  <p className="stat-value">{stats?.totalDrivers ?? '...'}</p>
                  <p className="stat-label">Всего водителей</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon-purple">💰</div>
                <div className="stat-content">
                  <p className="stat-value">{stats?.totalRevenue ? `${Math.round(stats.totalRevenue).toLocaleString()} ₽` : '...'}</p>
                  <p className="stat-label">Общая выручка</p>
                </div>
              </div>
            </div>
          </section>
        )}

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

        {tab === 'tariffs' && (
          <section className="card">
            <h2>Тарифы</h2>
            {!tariffForm ? (
              <>
                <button
                  className="button"
                  style={{ marginBottom: 16 }}
                  onClick={() =>
                    setTariffForm({
                      name: '',
                      baseFare: '100',
                      pricePerKm: '15',
                      pricePerMinute: '',
                      isActive: true,
                    })
                  }
                >
                  Добавить тариф
                </button>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Посадка, ₽</th>
                      <th>₽/км</th>
                      <th>₽/мин</th>
                      <th>Активен</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tariffs.map((t) => (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>{Number(t.baseFare)}</td>
                        <td>{Number(t.pricePerKm)}</td>
                        <td>{t.pricePerMinute != null ? Number(t.pricePerMinute) : '—'}</td>
                        <td>{t.isActive ? 'Да' : 'Нет'}</td>
                        <td>
                          <button
                            className="button"
                            style={{ marginRight: 8 }}
                            onClick={() => {
                              setEditingTariffId(t.id);
                              setTariffForm({
                                name: t.name,
                                baseFare: String(t.baseFare),
                                pricePerKm: String(t.pricePerKm),
                                pricePerMinute: t.pricePerMinute != null ? String(t.pricePerMinute) : '',
                                isActive: t.isActive,
                              });
                            }}
                          >
                            Редактировать
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!tariffForm) return;
                  setTariffError(null);

                  const name = tariffForm.name.trim();
                  const baseFareStr = tariffForm.baseFare.trim();
                  const pricePerKmStr = tariffForm.pricePerKm.trim();
                  const pricePerMinuteStr = tariffForm.pricePerMinute.trim();

                  const baseFare = baseFareStr === '' ? NaN : Number(baseFareStr);
                  const pricePerKm = pricePerKmStr === '' ? NaN : Number(pricePerKmStr);
                  const pricePerMinute =
                    pricePerMinuteStr === '' ? undefined : Number(pricePerMinuteStr);

                  if (!name) {
                    setTariffError('Укажите название тарифа.');
                    return;
                  }
                  if (!Number.isFinite(baseFare) || baseFare < 0) {
                    setTariffError('Поле «Посадка» должно быть числом ≥ 0.');
                    return;
                  }
                  if (!Number.isFinite(pricePerKm) || pricePerKm < 0) {
                    setTariffError('Поле «₽/км» должно быть числом ≥ 0.');
                    return;
                  }
                  if (pricePerMinute !== undefined && (!Number.isFinite(pricePerMinute) || pricePerMinute < 0)) {
                    setTariffError('Поле «₽/мин» должно быть числом ≥ 0 или пустым.');
                    return;
                  }

                  try {
                    if (editingTariffId) {
                      await client.patch(`/tariffs/${editingTariffId}`, {
                        name,
                        baseFare,
                        pricePerKm,
                        pricePerMinute,
                        isActive: tariffForm.isActive,
                      });
                    } else {
                      await client.post('/tariffs', {
                        name,
                        baseFare,
                        pricePerKm,
                        pricePerMinute,
                        isActive: tariffForm.isActive,
                      });
                    }
                    setTariffForm(null);
                    setEditingTariffId(null);
                    await loadTariffs();
                  } catch {
                    setTariffError('Не удалось сохранить тариф. Проверьте поля и попробуйте ещё раз.');
                  }
                }}
              >
                {tariffError && <div className="error" style={{ marginBottom: 12 }}>{tariffError}</div>}
                <div style={{ marginBottom: 12 }}>
                  <label>Название</label>
                  <input
                    className="input"
                    value={tariffForm.name}
                    onChange={(e) => setTariffForm({ ...tariffForm, name: e.target.value })}
                    required
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>Посадка, ₽</label>
                  <input
                    type="number"
                    className="input"
                    value={tariffForm.baseFare}
                    onChange={(e) => setTariffForm({ ...tariffForm, baseFare: e.target.value })}
                    required
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>₽/км</label>
                  <input
                    type="number"
                    className="input"
                    value={tariffForm.pricePerKm}
                    onChange={(e) => setTariffForm({ ...tariffForm, pricePerKm: e.target.value })}
                    required
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>₽/мин (опц.)</label>
                  <input
                    type="number"
                    className="input"
                    value={tariffForm.pricePerMinute}
                    onChange={(e) =>
                      setTariffForm({ ...tariffForm, pricePerMinute: e.target.value })
                    }
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={tariffForm.isActive}
                      onChange={(e) =>
                        setTariffForm({ ...tariffForm, isActive: e.target.checked })
                      }
                    />
                    Активен
                  </label>
                </div>
                <button type="submit" className="button" style={{ marginRight: 8 }}>
                  {editingTariffId ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setTariffForm(null);
                    setEditingTariffId(null);
                  }}
                >
                  Отмена
                </button>
              </form>
            )}
          </section>
        )}

        {tab === 'drivers' && (
          <section className="card">
            <h2>Водители</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Телефон</th>
                  <th>Имя</th>
                  <th>Авто</th>
                  <th>Статус</th>
                  <th>Онлайн</th>
                  <th>Баланс</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id}>
                    <td>{d.user.phone}</td>
                    <td>{d.fullName || '—'}</td>
                    <td>
                      {d.car
                        ? `${d.car.make} ${d.car.model}, ${d.car.plateNumber}`
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${d.status.toLowerCase()}`}>
                        {d.status === 'APPROVED' ? '✓ Одобрен' : d.status === 'REJECTED' ? '✕ Отклонен' : '⏳ Ожидает'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${d.isOnline ? 'online' : 'offline'}`}>
                        {d.isOnline ? 'Онлайн' : 'Офлайн'}
                      </span>
                    </td>
                    <td>{d.balance != null ? Number(d.balance).toFixed(2) : '0.00'} ₽</td>
                    <td>
                      <button
                        className="button button-primary"
                        style={{ marginRight: 8 }}
                        onClick={() => {
                          const amountStr = window.prompt('Введите сумму для пополнения (₽):', '100');
                          if (!amountStr) return;
                          const amount = parseFloat(amountStr);
                          if (Number.isNaN(amount) || amount <= 0) {
                            alert('Сумма должна быть положительным числом');
                            return;
                          }
                          client
                            .patch(`/admin/drivers/${d.id}/top-up`, { amount })
                            .then(() => loadDrivers())
                            .catch(() => alert('Не удалось пополнить баланс'));
                        }}
                      >
                        Пополнить
                      </button>
                      {d.status === 'PENDING' && (
                        <>
                          <button
                            className="button button-success"
                            style={{ marginRight: 8 }}
                            onClick={async () => {
                              try {
                                await client.patch(`/admin/drivers/${d.id}/status`, {
                                  status: 'APPROVED',
                                });
                                await loadDrivers();
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            Одобрить
                          </button>
                          <button
                            className="button button-danger"
                            onClick={async () => {
                              try {
                                await client.patch(`/admin/drivers/${d.id}/status`, {
                                  status: 'REJECTED',
                                });
                                await loadDrivers();
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            Отклонить
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
};

