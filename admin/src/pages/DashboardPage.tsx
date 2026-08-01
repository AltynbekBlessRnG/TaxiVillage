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

type Tab =
  | 'overview'
  | 'users'
  | 'drivers'
  | 'rides'
  | 'tariffs'
  | 'merchants'
  | 'foodOrders'
  | 'promos'
  | 'economics'
  | 'problems';

interface Stats {
  totalRides: number;
  totalDrivers: number;
  totalRevenue: number;
}

interface Merchant {
  id: string;
  name: string;
  cuisine?: string | null;
  address?: string | null;
  contactPhone?: string | null;
  isOpen: boolean;
  verificationStatus: string;
  deliveryFee: number | string;
  commissionPercent: number;
  freeOrderLimit: number;
  completedOrderCount: number;
  commissionDebt: number | string;
  user: { phone: string };
  menuCategories?: Array<{ id: string; name: string; items: unknown[] }>;
}

interface FoodOrder {
  id: string;
  createdAt: string;
  status: string;
  deliveryAddress: string;
  subtotal: number | string;
  deliveryFee: number | string;
  totalPrice: number | string;
  cancellationReason?: string | null;
  merchant: { name: string };
  passenger: { fullName?: string | null; user: { phone: string } };
  driver?: { id: string; fullName?: string | null; user: { phone: string } } | null;
}

interface PromoCode {
  id: string;
  code: string;
  discountType: string;
  discountValue: number | string;
  usageCount: number;
  usageLimit?: number | null;
  isActive: boolean;
  merchant?: { name: string } | null;
}

interface FoodEconomics {
  deliveredOrders: number;
  gmv: number;
  deliveryRevenue: number;
  commissionRevenue: number;
  discounts: number;
  commissionDebt: number;
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
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [foodOrders, setFoodOrders] = useState<FoodOrder[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [economics, setEconomics] = useState<FoodEconomics | null>(null);
  const [problems, setProblems] = useState<Array<FoodOrder & { problem: string }>>([]);
  
  // Состояние для модалки документов
  const [selectedDriverDocs, setSelectedDriverDocs] = useState<Driver | null>(null);

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

  const loadMerchants = React.useCallback(async () => {
    const res = await client.get('/admin/merchants');
    setMerchants(res.data);
  }, [client]);

  const loadFoodOrders = React.useCallback(async () => {
    const res = await client.get('/admin/food-orders');
    setFoodOrders(res.data);
  }, [client]);

  const loadPromoCodes = React.useCallback(async () => {
    const res = await client.get('/admin/promo-codes');
    setPromoCodes(res.data);
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
      if (tab === 'merchants') await loadMerchants();
      if (tab === 'foodOrders') {
        await Promise.all([loadFoodOrders(), loadDrivers()]);
      }
      if (tab === 'promos') await loadPromoCodes();
      if (tab === 'economics') {
        const res = await client.get('/admin/food-economics');
        setEconomics(res.data);
      }
      if (tab === 'problems') {
        const res = await client.get('/admin/food-problems');
        setProblems(res.data);
      }
    };
    load().catch(() => {});
  }, [
    tab,
    client,
    loadDrivers,
    loadTariffs,
    loadStats,
    loadMerchants,
    loadFoodOrders,
    loadPromoCodes,
  ]);

  const createMerchant = async () => {
    const phone = window.prompt('Телефон партнёра в международном формате');
    if (!phone) return;
    const password = window.prompt('Временный пароль, минимум 6 символов');
    if (!password) return;
    const name = window.prompt('Название заведения');
    if (!name) return;
    const address = window.prompt('Адрес заведения') || undefined;
    await client.post('/admin/merchants', { phone, password, name, address });
    await loadMerchants();
  };

  const updateMerchant = async (
    merchantId: string,
    data: Record<string, unknown>,
  ) => {
    await client.patch(`/admin/merchants/${merchantId}`, data);
    await loadMerchants();
  };

  const configureMerchant = async (merchant: Merchant) => {
    const deliveryFee = window.prompt(
      'Стоимость доставки, ₸',
      String(Number(merchant.deliveryFee)),
    );
    if (deliveryFee == null) return;
    const commissionPercent = window.prompt(
      'Комиссия после бесплатного периода, %',
      String(merchant.commissionPercent),
    );
    if (commissionPercent == null) return;
    const freeOrderLimit = window.prompt(
      'Количество бесплатных заказов',
      String(merchant.freeOrderLimit),
    );
    if (freeOrderLimit == null) return;
    await updateMerchant(merchant.id, {
      deliveryFee: Number(deliveryFee),
      commissionPercent: Number(commissionPercent),
      freeOrderLimit: Number(freeOrderLimit),
    });
  };

  const recordMerchantPayment = async (merchant: Merchant) => {
    const amount = window.prompt(
      `Долг: ${Number(merchant.commissionDebt).toFixed(0)} ₸. Введите оплату`,
    );
    if (!amount) return;
    await client.post(`/admin/merchants/${merchant.id}/settlements/payment`, {
      amount: Number(amount),
    });
    await loadMerchants();
  };

  const addMerchantMenuItem = async (merchant: Merchant) => {
    let categories = merchant.menuCategories || [];
    let categoryId = categories[0]?.id;
    if (categories.length > 0) {
      const listing = categories.map((category) => `${category.id}: ${category.name}`).join('\n');
      const selectedCategoryId = window.prompt(
        `ID категории:\n${listing}`,
        categoryId || '',
      );
      if (!selectedCategoryId) return;
      categoryId = selectedCategoryId;
    } else {
      const categoryName = window.prompt('Название первой категории', 'Основное меню');
      if (!categoryName) return;
      const response = await client.post(`/admin/merchants/${merchant.id}/menu/categories`, {
        name: categoryName,
      });
      categoryId = response.data.id;
      categories = [response.data];
    }
    const name = window.prompt('Название блюда');
    if (!name) return;
    const price = window.prompt('Цена, ₸');
    if (!price) return;
    const description = window.prompt('Описание блюда') || undefined;
    await client.post(`/admin/merchants/${merchant.id}/menu/items`, {
      categoryId,
      name,
      price: Number(price),
      description,
    });
    await loadMerchants();
  };

  const assignFoodDriver = async (order: FoodOrder) => {
    const availableDrivers = drivers.filter((driver) => driver.status === 'APPROVED');
    const listing = availableDrivers
      .map((driver) => `${driver.id}: ${driver.fullName || driver.user.phone}`)
      .join('\n');
    const driverId = window.prompt(`Введите ID водителя:\n${listing}`);
    if (!driverId) return;
    await client.post(`/admin/food-orders/${order.id}/assign-driver`, { driverId });
    await loadFoodOrders();
  };

  const cancelFoodOrder = async (order: FoodOrder) => {
    const reason = window.prompt('Причина отмены');
    if (!reason) return;
    await client.post(`/admin/food-orders/${order.id}/cancel`, { reason });
    await loadFoodOrders();
  };

  const createPromoCode = async () => {
    const code = window.prompt('Промокод', 'USHARAL500');
    if (!code) return;
    const value = window.prompt('Скидка в тенге', '500');
    if (!value) return;
    const limit = window.prompt('Общий лимит использований', '100');
    if (!limit) return;
    await client.post('/admin/promo-codes', {
      code,
      discountType: 'FIXED',
      discountValue: Number(value),
      usageLimit: Number(limit),
      perUserLimit: 1,
    });
    await loadPromoCodes();
  };

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
    } catch {
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

  const handleTopUpBalance = async (driver: Driver) => {
    const rawAmount = window.prompt(
      `Пополнить баланс водителя ${driver.fullName || driver.user.phone}\nТекущий баланс: ${Number(driver.balance || 0).toFixed(0)} ₸\n\nВведите сумму пополнения в тенге:`,
      '1000',
    );

    if (!rawAmount) {
      return;
    }

    const amount = Number(rawAmount.replace(',', '.').trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert('Введите корректную сумму больше 0.');
      return;
    }

    try {
      await client.patch(`/admin/drivers/${driver.id}/top-up`, { amount });
      await loadDrivers();
      window.alert(`Баланс пополнен на ${amount.toFixed(0)} ₸`);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось пополнить баланс';
      window.alert(Array.isArray(message) ? message.join(', ') : String(message));
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
          <button className={tab === 'merchants' ? 'active' : ''} onClick={() => setTab('merchants')}>🏪 Заведения</button>
          <button className={tab === 'foodOrders' ? 'active' : ''} onClick={() => setTab('foodOrders')}>🍽 Заказы еды</button>
          <button className={tab === 'promos' ? 'active' : ''} onClick={() => setTab('promos')}>🎟 Промокоды</button>
          <button className={tab === 'economics' ? 'active' : ''} onClick={() => setTab('economics')}>📈 Экономика еды</button>
          <button className={tab === 'problems' ? 'active' : ''} onClick={() => setTab('problems')}>⚠️ Проблемы</button>
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
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        <button className="button button-success" onClick={() => client.patch(`/admin/drivers/${d.id}/status`, { status: 'APPROVED' }).then(loadDrivers)}>Одобрить</button>
                        <button className="button button-accent" onClick={() => handleTopUpBalance(d)}>Пополнить</button>
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

        {tab === 'merchants' && (
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Заведения</h2>
                <p className="muted">Партнёры появляются в приложении только после проверки.</p>
              </div>
              <button className="button button-primary" onClick={() => void createMerchant()}>
                Добавить заведение
              </button>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Заведение</th>
                    <th>Контакты</th>
                    <th>Статус</th>
                    <th>Заказы</th>
                    <th>Доставка</th>
                    <th>Долг</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map((merchant) => (
                    <tr key={merchant.id}>
                      <td>
                        <strong>{merchant.name}</strong>
                        <div className="muted">{merchant.address || 'Адрес не указан'}</div>
                      </td>
                      <td>{merchant.contactPhone || merchant.user.phone}</td>
                      <td>
                        <span className={`badge badge-${merchant.verificationStatus.toLowerCase()}`}>
                          {merchant.verificationStatus}
                        </span>
                      </td>
                      <td>
                        {merchant.completedOrderCount}/{merchant.freeOrderLimit} бесплатно
                      </td>
                      <td>{Number(merchant.deliveryFee).toFixed(0)} ₸</td>
                      <td>{Number(merchant.commissionDebt).toFixed(0)} ₸</td>
                      <td>
                        <div className="action-row">
                          <button
                            className="button button-success"
                            onClick={() =>
                              void updateMerchant(merchant.id, {
                                verificationStatus: 'VERIFIED',
                              })
                            }
                          >
                            Проверить
                          </button>
                          <button
                            className="button"
                            onClick={() => void configureMerchant(merchant)}
                          >
                            Тариф
                          </button>
                          <button
                            className="button"
                            onClick={() => void addMerchantMenuItem(merchant)}
                          >
                            + Блюдо
                          </button>
                          <button
                            className="button button-accent"
                            onClick={() => void recordMerchantPayment(merchant)}
                          >
                            Оплата
                          </button>
                          <button
                            className="button button-danger"
                            onClick={() =>
                              void updateMerchant(merchant.id, {
                                verificationStatus: 'SUSPENDED',
                                isOpen: false,
                              })
                            }
                          >
                            Стоп
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'foodOrders' && (
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Заказы еды</h2>
                <p className="muted">Назначайте водителя вручную только для зависших заказов.</p>
              </div>
              <button className="button" onClick={() => void loadFoodOrders()}>
                Обновить
              </button>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Заведение</th>
                    <th>Клиент</th>
                    <th>Статус</th>
                    <th>Водитель</th>
                    <th>Сумма</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {foodOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{new Date(order.createdAt).toLocaleString('ru-RU')}</td>
                      <td>{order.merchant.name}</td>
                      <td>
                        {order.passenger.fullName || order.passenger.user.phone}
                        <div className="muted">{order.deliveryAddress}</div>
                      </td>
                      <td><span className="badge badge-online">{order.status}</span></td>
                      <td>{order.driver?.fullName || order.driver?.user.phone || 'Не назначен'}</td>
                      <td>{Number(order.totalPrice).toFixed(0)} ₸</td>
                      <td>
                        <div className="action-row">
                          {['SEARCHING_DRIVER', 'DRIVER_ASSIGNED'].includes(order.status) ? (
                            <button
                              className="button button-accent"
                              onClick={() => void assignFoodDriver(order)}
                            >
                              Назначить
                            </button>
                          ) : null}
                          {!['DELIVERED', 'CANCELED'].includes(order.status) ? (
                            <button
                              className="button button-danger"
                              onClick={() => void cancelFoodOrder(order)}
                            >
                              Отменить
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'promos' && (
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Промокоды</h2>
                <p className="muted">Первый код beta ограничен одним применением на клиента.</p>
              </div>
              <button className="button button-primary" onClick={() => void createPromoCode()}>
                Создать промокод
              </button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Партнёр</th>
                  <th>Скидка</th>
                  <th>Использовано</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((promo) => (
                  <tr key={promo.id}>
                    <td><strong>{promo.code}</strong></td>
                    <td>{promo.merchant?.name || 'Все заведения'}</td>
                    <td>
                      {Number(promo.discountValue).toFixed(0)}
                      {promo.discountType === 'PERCENT' ? '%' : ' ₸'}
                    </td>
                    <td>{promo.usageCount}/{promo.usageLimit || '∞'}</td>
                    <td>{promo.isActive ? 'Активен' : 'Остановлен'}</td>
                    <td>
                      <button
                        className="button"
                        onClick={() =>
                          client
                            .patch(`/admin/promo-codes/${promo.id}`, {
                              isActive: !promo.isActive,
                            })
                            .then(loadPromoCodes)
                        }
                      >
                        {promo.isActive ? 'Остановить' : 'Включить'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'economics' && (
          <section>
            <div className="stats-grid">
              {[
                ['Доставлено', economics?.deliveredOrders ?? 0],
                ['GMV еды', `${Math.round(economics?.gmv || 0).toLocaleString()} ₸`],
                ['Комиссия', `${Math.round(economics?.commissionRevenue || 0).toLocaleString()} ₸`],
                ['Доставка', `${Math.round(economics?.deliveryRevenue || 0).toLocaleString()} ₸`],
                ['Скидки', `${Math.round(economics?.discounts || 0).toLocaleString()} ₸`],
                ['Долг партнёров', `${Math.round(economics?.commissionDebt || 0).toLocaleString()} ₸`],
              ].map(([label, value]) => (
                <div className="stat-card" key={String(label)}>
                  <div className="stat-content">
                    <p className="stat-value">{value}</p>
                    <p className="stat-label">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'problems' && (
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Проблемные заказы</h2>
                <p className="muted">
                  Не приняты заведением за 5 минут, без водителя за 10 минут и отменённые.
                </p>
              </div>
              <button
                className="button"
                onClick={() =>
                  client.get('/admin/food-problems').then((res) => setProblems(res.data))
                }
              >
                Обновить
              </button>
            </div>
            <table className="table">
              <thead>
                <tr><th>Проблема</th><th>Заведение</th><th>Статус</th><th>Создан</th><th>Причина</th></tr>
              </thead>
              <tbody>
                {problems.map((order) => (
                  <tr key={order.id}>
                    <td><span className="badge badge-rejected">{order.problem}</span></td>
                    <td>{order.merchant.name}</td>
                    <td>{order.status}</td>
                    <td>{new Date(order.createdAt).toLocaleString('ru-RU')}</td>
                    <td>{order.cancellationReason || '—'}</td>
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
