# TaxiVillage

TaxiVillage — мультисервисное приложение для города и межгорода с единым стеком:

- такси
- курьер
- еда
- межгород
- чаты
- пуш-уведомления
- единый worker flow для водителя/курьера/межгорода

Проект состоит из трех основных частей:

- [backend](C:\Users\Duman\TaxiVillage\backend) — NestJS + Prisma + PostgreSQL + Redis
- [mobile](C:\Users\Duman\TaxiVillage\mobile) — React Native / Expo dev build
- [admin](C:\Users\Duman\TaxiVillage\admin) — React + Vite

## Стек

### Backend

- NestJS 10
- Prisma
- PostgreSQL
- Redis
- Socket.IO
- BullMQ
- JWT auth

### Mobile

- Expo
- React Native
- React Navigation
- `@gorhom/bottom-sheet`
- `react-native-maps`
- `expo-location`
- `expo-notifications`
- `socket.io-client`

### Admin

- React
- Vite
- Axios

## Что уже реализовано

### Пассажир

- заказ такси на карте
- активная поездка внутри home без отдельного status-screen
- заказ курьера на карте
- история адресов
- чат по такси
- еда: каталог, ресторан, checkout, status
- межгород: предложения, бронирование, свои заявки, чат
- локальный inbox уведомлений
- unread badges для сообщений и уведомлений

### Водитель / курьер

- единый `DriverHome`
- единый `DriverProfile`
- отдельный экран `Данные и документы`
- режимы:
  - такси
  - курьер
  - межгород
- активный заказ и действия внутри нижней шторки
- чат с клиентом в активной поездке
- метрики за 7 дней

### Merchant

- dashboard
- menu editor
- food orders
- realtime-обновления заказов

### Backend / infra

- Redis-first presence и hot location cache
- active assignment recovery через Redis
- единый Socket.IO namespace `/app`
- unified chat storage через `ChatMessage`
- BullMQ для push-очереди
- Docker Compose для локального окружения
- базовые unit tests для критичных сервисов

## Структура проекта

```text
TaxiVillage/
├─ admin/
├─ backend/
│  ├─ prisma/
│  ├─ src/
│  └─ Dockerfile
├─ docs/
├─ mobile/
└─ docker-compose.yml
```

## Быстрый старт без Docker

### 1. Backend

Создай `.env` в [backend](C:\Users\Duman\TaxiVillage\backend) на основе [backend/.env.example](C:\Users\Duman\TaxiVillage\backend\.env.example):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/taxivillage
JWT_SECRET=change_me
PORT=3000
REDIS_URL=redis://127.0.0.1:6379
```

Установка и запуск:

```powershell
cd C:\Users\Duman\TaxiVillage\backend
npm install
npx prisma migrate deploy
npm run prisma:generate
npm run start:dev
```

Backend будет доступен по адресу:

```text
http://localhost:3000/api
```

### 2. Mobile

Создай `.env` в [mobile](C:\Users\Duman\TaxiVillage\mobile) на основе [mobile/.env.example](C:\Users\Duman\TaxiVillage\mobile\.env.example):

```env
EXPO_PUBLIC_API_URL=http://192.168.0.10:3000/api
EXPO_PUBLIC_EAS_PROJECT_ID=your-expo-project-id
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Важно:

- `EXPO_PUBLIC_API_URL` должен смотреть на IP твоего компьютера в локальной сети, если запускаешь на телефоне
- для Android emulator обычно удобно использовать `10.0.2.2`
- Google Maps key в mobile-приложении по природе будет client-visible, поэтому обязательно ограничь ключ в Google Cloud Console по Android/iOS application restrictions

Установка и запуск:

```powershell
cd C:\Users\Duman\TaxiVillage\mobile
npm install
```

Если это Expo Go:

```powershell
npx expo start -c
```

Если это dev build:

```powershell
npx expo run:android
npx expo start --dev-client -c
```

### 3. Admin

Создай `.env` в [admin](C:\Users\Duman\TaxiVillage\admin) на основе [admin/.env.example](C:\Users\Duman\TaxiVillage\admin\.env.example):

```env
VITE_API_URL=http://127.0.0.1:3000/api
```

Запуск:

```powershell
cd C:\Users\Duman\TaxiVillage\admin
npm install
npm run dev
```

## Быстрый старт через Docker

В проекте уже есть [docker-compose.yml](C:\Users\Duman\TaxiVillage\docker-compose.yml) с:

- PostgreSQL
- Redis
- backend

Запуск:

```powershell
cd C:\Users\Duman\TaxiVillage
docker compose up --build
```

После старта:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- backend API: `http://localhost:3000/api`

Что делает backend container:

- ставит зависимости
- генерирует Prisma client
- применяет `prisma migrate deploy`
- запускает `dist/main.js`

## Тесты

Backend unit tests:

```powershell
cd C:\Users\Duman\TaxiVillage\backend
npm test -- --runInBand
```

Сейчас есть тесты для:

- [rides.service.spec.ts](C:\Users\Duman\TaxiVillage\backend\src\rides\rides.service.spec.ts)
- [courier-orders.service.spec.ts](C:\Users\Duman\TaxiVillage\backend\src\courier-orders\courier-orders.service.spec.ts)
- [intercity-orders.service.spec.ts](C:\Users\Duman\TaxiVillage\backend\src\intercity-orders\intercity-orders.service.spec.ts)
- [chat.service.spec.ts](C:\Users\Duman\TaxiVillage\backend\src\chat\chat.service.spec.ts)
- [intercity-chat.service.spec.ts](C:\Users\Duman\TaxiVillage\backend\src\intercity-chat\intercity-chat.service.spec.ts)
- [drivers.service.spec.ts](C:\Users\Duman\TaxiVillage\backend\src\drivers\drivers.service.spec.ts)

Backend E2E tests для realtime taxi-цепочки:

1. Подними изолированные Postgres и Redis:

```powershell
cd C:\Users\Duman\TaxiVillage
docker compose -f docker-compose.e2e.yml up -d
```

2. Создай [backend/.env.e2e](C:\Users\Duman\TaxiVillage\backend\.env.e2e) на основе [backend/.env.e2e.example](C:\Users\Duman\TaxiVillage\backend\.env.e2e.example)

3. В новом терминале подними backend на этом env:

```powershell
cd C:\Users\Duman\TaxiVillage\backend
$env:ENV_FILE=".env.e2e"
npx prisma migrate deploy
npm run start:dev
```

4. Прогони e2e:

```powershell
cd C:\Users\Duman\TaxiVillage\backend
$env:ENV_FILE=".env.e2e"
npm run test:e2e
```

Сейчас E2E покрывают:

- passenger create ride
- driver receives `ride:offer`
- driver accepts
- passenger and driver receive `ride:updated`
- Redis active assignment и recovery endpoints совпадают
- driver disconnect and reconnect recovery
- cancel cleanup очищает Redis assignment

Socket load harness для 10-20 водителей:

```powershell
cd C:\Users\Duman\TaxiVillage\backend
npm run socket:load
```

Можно переопределять через env:

- `BACKEND_URL`
- `REDIS_URL`
- `DRIVER_COUNT`
- `DURATION_SECONDS`
- `LOCATION_INTERVAL_MS`

Manual QA по reconnect:

- [docs/mobile-reconnect-checklist.md](C:\Users\Duman\TaxiVillage\docs\mobile-reconnect-checklist.md)

## Архитектурные заметки

### 1. Unified worker model

Сейчас основной worker-профиль один:

- `DriverProfile`

Старые отдельные worker-profile таблицы уже убраны из основной архитектуры.

### 2. Unified mobile worker flow

Для водителя основной сценарий живет через:

- [DriverHomeScreen.tsx](C:\Users\Duman\TaxiVillage\mobile\src\screens\Driver\DriverHomeScreen.tsx)
- [DriverStatusSheet.tsx](C:\Users\Duman\TaxiVillage\mobile\src\components\Driver\DriverStatusSheet.tsx)

То есть принятие заказа, активная поездка и действия водителя происходят без отдельного “мигающего” screen switch.

### 3. Passenger active flow

Для пассажира активные taxi/courier flow живут через:

- [PassengerHomeScreen.tsx](C:\Users\Duman\TaxiVillage\mobile\src\screens\Passenger\PassengerHomeScreen.tsx)

Старые legacy-экраны пассажира вычищены из основного UX.

### 4. Realtime

Realtime построен на:

- единый Socket.IO namespace `/app`
- Redis adapter
- Redis presence
- Redis-first active assignments
- Redis hot location cache

### 5. Notifications

Пуши отправляются через:

- [NotificationsService](C:\Users\Duman\TaxiVillage\backend\src\notifications\notifications.service.ts)
- [NotificationsQueueService](C:\Users\Duman\TaxiVillage\backend\src\notifications\notifications-queue.service.ts)

Если `REDIS_URL` не задан, очередь отключается безопасно, а backend не падает.

## Полезные команды

### Backend

```powershell
cd C:\Users\Duman\TaxiVillage\backend
npm run build
npm run start:dev
npm run prisma:generate
npx prisma migrate deploy
npm test -- --runInBand
npm run test:e2e
npm run socket:load
```

### Mobile

```powershell
cd C:\Users\Duman\TaxiVillage\mobile
npx expo run:android
npx expo start --dev-client -c
```

### Admin

```powershell
cd C:\Users\Duman\TaxiVillage\admin
npm run dev
npm run build
```

## Частые проблемы

### `Network Error` в mobile

Проверь:

- backend запущен
- `EXPO_PUBLIC_API_URL` указывает на правильный IP
- телефон и компьютер в одной сети
- socket base и API base совпадают

### Push notifications skipped: missing Expo projectId

Добавь в [mobile/.env](C:\Users\Duman\TaxiVillage\mobile\.env):

```env
EXPO_PUBLIC_EAS_PROJECT_ID=your-expo-project-id
```

### Prisma runtime error про отсутствующую колонку

Значит код обновился, а миграции еще нет. Выполни:

```powershell
cd C:\Users\Duman\TaxiVillage\backend
npx prisma migrate deploy
npm run prisma:generate
```

### Android dev build не собирается после нативных изменений

После изменений в:

- `expo-notifications`
- `react-native-reanimated`
- `react-native-gesture-handler`
- `@gorhom/bottom-sheet`

нужно заново собрать dev build:

```powershell
cd C:\Users\Duman\TaxiVillage\mobile
npx expo run:android
```

## Что логично делать дальше

- расширять backend unit tests
- расширять integration/e2e tests на courier, food и intercity
- довести Docker до полного dev stack с admin proxy при необходимости
- добавить CI на build + test
- продолжать продуктовый polish без возврата к legacy flow

## Статус

Проект находится в активной разработке. Архитектура уже заметно чище, чем была раньше:

- меньше legacy screen flow
- единый worker model
- единый socket namespace
- unified chat storage
- Redis-first realtime infrastructure
- базовое тестовое покрытие

README рассчитан как основной onboarding-документ для локальной разработки TaxiVillage.
