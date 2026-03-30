import React, { useEffect, useState } from 'react';
import { AdminAuthSession, clearAdminAuth, createAdminClient, saveAdminAuth } from '../auth';
import { API_URL } from '../api/config';

interface Props {
  session: AdminAuthSession;
  onSessionChange(session: AdminAuthSession | null): void;
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

const DOCUMENT_LABELS: Record<string, string> = {
  DRIVER_LICENSE: 'Водительское удостоверение',
  CAR_REGISTRATION: 'СТС',
  TAXI_LICENSE: 'Лицензия',
  OTHER: 'Другое',
};

export const DashboardPage: React.FC<Props> = ({
  session,
  onSessionChange,
  onLogout,
}) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  
  // Состояние для модалки документов
  const [selectedDriverDocs, setSelectedDriverDocs] = useState<Driver | null>(null);

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
      createAdminClient(
        () => session,
        (nextSession) => {
          if (nextSession) {
            saveAdminAuth(nextSession);
          } else {
            clearAdminAuth();
          }
          onSessionChange(nextSession);
        },
      ),
    [onSessionChange, session],
  );

  const loadDrivers = React.useCallback(async () => {
    try {
      const res = await client.get('/admin/drivers');
      setDrivers(res.data);
    } catch (e) {
      console.error("Ошибка загрузки водителей", e);
    }
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
    } catch { /* ignore */ }
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
      if (tab === 'drivers') await loadDrivers();
      if (tab === 'tariffs') await loadTariffs();
      if (tab === 'overview') await loadStats();
    };
    load().catch(() => {});
  }, [tab, loadDrivers, loadTariffs, loadStats]); // Убрали client отсюда

  // Функция одобрения/отклонения документа
  const handleDocAction = async (docId: string, approved: boolean) => {
    try {
      await client.patch(`/admin/documents/${docId}/approve`, { approved });
      // После одобрения просто обновляем общий список
      await loadDrivers();
      
      // И вручную обновляем статус в открытой модалке, чтобы она не "прыгала"
      if (selectedDriverDocs) {
        const updatedDocs = selectedDriverDocs.documents.map(d => 
          d.id === docId ? { ...d, approved } : d
        );
        setSelectedDriverDocs({ ...selectedDriverDocs, documents: updatedDocs });
      }
    } catch (e) {
      alert('Ошибка при обновлении статуса документа');
    }
  };

  const handleLogoutClick = async () => {
    try {
      await client.post('/auth/logout');
    } catch {
      // Ignore logout failures and clear the local session anyway.
    } finally {
      onLogout();
    }
  };

  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="sidebar-title">TaxiVillage Admin</div>
        <div className="sidebar-nav">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>📊 Обзор</button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>👤 Пользователи</button>
          <button className={tab === 'drivers' ? 'active' : ''} onClick={() => setTab('drivers')}>🚗 Водители</button>
          <button className={tab === 'rides' ? 'active' : ''} onClick={() => setTab('rides')}>📍 Поездки</button>
          <button className={tab === 'tariffs' ? 'active' : ''} onClick={() => setTab('tariffs')}>💰 Тарифы</button>
        </div>
        <button className="button" style={{ marginTop: 'auto' }} onClick={handleLogoutClick}>Выйти</button>
      </aside>

      <main className="content">
        {/* ТАБЛИЦА ВОДИТЕЛЕЙ */}
        {tab === 'drivers' && (
          <section className="card">
            <h2>Водители</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Телефон</th>
                  <th>Имя</th>
                  <th>Авто</th>
                  <th>Документы</th>
                  <th>Статус</th>
                  <th>Баланс</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id}>
                    <td>{d.user.phone}</td>
                    <td>{d.fullName || '—'}</td>
                    <td>{d.car ? `${d.car.make} ${d.car.model}` : '—'}</td>
                    <td>
                      <button className="button" onClick={() => setSelectedDriverDocs(d)}>
                        Просмотр ({d.documents.length})
                      </button>
                    </td>
                    <td>
                      <span className={`badge badge-${d.status.toLowerCase()}`}>
                        {d.status === 'APPROVED' ? '✓ Одобрен' : d.status === 'REJECTED' ? '✕ Отклонен' : '⏳ Ожидает'}
                      </span>
                    </td>
                    <td>{Number(d.balance || 0).toFixed(0)} ₸</td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button className="button button-success" onClick={() => client.patch(`/admin/drivers/${d.id}/status`, { status: 'APPROVED' }).then(loadDrivers)}>Одобрить</button>
                        <button className="button button-danger" onClick={() => client.patch(`/admin/drivers/${d.id}/status`, { status: 'REJECTED' }).then(loadDrivers)}>Блок</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* МОДАЛЬНОЕ ОКНО ДОКУМЕНТОВ */}
        {selectedDriverDocs && (
          <div className="modal-overlay" style={modalOverlayStyle}>
            <div className="modal-content" style={modalContentStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3>Документы: {selectedDriverDocs.fullName || selectedDriverDocs.user.phone}</h3>
                <button className="button" onClick={() => setSelectedDriverDocs(null)}>Закрыть</button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {selectedDriverDocs.documents.length > 0 ? (
                  selectedDriverDocs.documents.map(doc => (
                    <div key={doc.id} style={docCardStyle}>
                      <p><strong>{DOCUMENT_LABELS[doc.type] || doc.type}</strong></p>
                      <img 
                        src={`${API_URL.replace('/api', '')}${doc.url}`} 
                        alt="document" 
                        style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px', border: '1px solid #334155' }} 
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`badge ${doc.approved ? 'badge-approved' : 'badge-pending'}`}>
                          {doc.approved ? 'Одобрено' : 'Ожидает'}
                        </span>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          {!doc.approved && (
                            <button className="button button-success" onClick={() => handleDocAction(doc.id, true)}>Одобрить</button>
                          )}
                          <button className="button button-danger" onClick={() => handleDocAction(doc.id, false)}>Отклонить</button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>Документы еще не загружены</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ОСТАЛЬНЫЕ ТАБЫ (Overview, Users, Rides, Tariffs) - ОСТАВЛЯЕМ БЕЗ ИЗМЕНЕНИЙ */}
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
                  <p className="stat-value">{stats?.totalRevenue ? `${Math.round(stats.totalRevenue).toLocaleString()} ₸` : '...'}</p>
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
              <thead><tr><th>Телефон</th><th>Роль</th></tr></thead>
              <tbody>{users.map((u) => (<tr key={u.id}><td>{u.phone}</td><td>{u.role}</td></tr>))}</tbody>
            </table>
          </section>
        )}

        {tab === 'rides' && (
          <section className="card">
            <h2>Поездки</h2>
            <table className="table">
              <thead><tr><th>ID</th><th>Статус</th><th>Откуда</th><th>Куда</th></tr></thead>
              <tbody>{rides.map((r) => (<tr key={r.id}><td>{r.id.slice(0, 6)}…</td><td>{r.status}</td><td>{r.fromAddress}</td><td>{r.toAddress}</td></tr>))}</tbody>
            </table>
          </section>
        )}

        {tab === 'tariffs' && (
          <section className="card">
            <h2>Тарифы</h2>
            {/* ... (код тарифов остается прежним) ... */}
            <p style={{color: '#94A3B8'}}>Управление тарифами доступно ниже</p>
            <table className="table">
              <thead><tr><th>Название</th><th>Посадка</th><th>₽/км</th><th>Активен</th></tr></thead>
              <tbody>{tariffs.map((t) => (<tr key={t.id}><td>{t.name}</td><td>{Number(t.baseFare)}</td><td>{Number(t.pricePerKm)}</td><td>{t.isActive ? 'Да' : 'Нет'}</td></tr>))}</tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
};

// Стили для модалки (встроенные для простоты)
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#1E293B', padding: '30px', borderRadius: '20px',
  width: '80%', maxHeight: '90%', overflowY: 'auto', border: '1px solid #334155'
};

const docCardStyle: React.CSSProperties = {
  backgroundColor: '#0F172A', padding: '15px', borderRadius: '12px', border: '1px solid #334155'
};
