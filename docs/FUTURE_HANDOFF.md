# TaxiVillage handoff для будущего Codex

Дата фиксации: 2026-08-01  
Рабочая папка: `C:\Users\Altynbek\Documents\Work\TaxiVillage`  
Текущая ветка: `main`

Этот файл нужен, чтобы после переустановки Windows на Linux не потерять контекст. В репозитории уже сделан большой шаг от простого такси к beta-сценарию: заказ готовой еды из заведений Ушарала внутри TaxiVillage, доставка местными водителями, админское управление и подготовка к App Store / Google Play.

## Зачем это делали

Идея продукта: TaxiVillage должен стать локальным агрегатором еды для малых городов, где большим сервисам невыгодно строить сеть. Для beta выбран Ушарал, язык beta - русский, оплата - наличные и Kaspi переводом, доставка - водителями TaxiVillage.

Главная логика beta:

- заказ еды оформляется внутри приложения, WhatsApp остается только резервным контактом;
- сервер считает цены, скидку, доставку, комиссию и выплату водителю;
- заведения сначала подключаются вручную администратором;
- первые 30 выполненных заказов партнера - без комиссии;
- после регистрации ИП и проверки спроса комиссия с еды - 7%;
- доставка в beta стоит 700 KZT и полностью идет водителю;
- KFC и другие сети можно добавлять только если есть реальная точка и согласие партнера.

## Что уже реализовано

### Backend и база данных

Основные файлы:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260730160000_add_food_delivery_beta/migration.sql`
- `backend/src/food-orders/food-orders.service.ts`
- `backend/src/food-orders/food-orders.controller.ts`
- `backend/src/food-orders/food-orders.gateway.ts`
- `backend/src/food-orders/food-order-alerts.service.ts`
- `backend/src/admin/admin.controller.ts`
- `backend/src/merchants/merchants.service.ts`

Добавлено:

- расширенная модель `Merchant`: адрес, координаты, график, зона доставки, стоимость доставки, комиссия, бесплатные заказы, долг, статус проверки, контакты, логотип;
- расширенная модель `FoodOrder`: водитель, server-side subtotal/delivery/discount/commission/driver payout, snapshots контактов, причина отмены, timestamps, promo/idempotency;
- новые статусы заказа еды: `PLACED -> ACCEPTED -> PREPARING -> SEARCHING_DRIVER -> DRIVER_ASSIGNED -> AT_MERCHANT -> ON_DELIVERY -> DELIVERED`;
- новый способ оплаты еды `KASPI_TRANSFER`; `CARD` оставлен в enum для совместимости, но для food orders сервер его отклоняет;
- управляемые промокоды в БД: `PromoCode`, `PromoCodeRedemption`;
- журнал расчетов с заведениями: `MerchantSettlement`;
- server-side checkout: проверка графика, verified/open статуса, зоны доставки, текущих цен меню, доступности блюд, промокода и idempotency key;
- история заказов и повтор заказа;
- отмена заказа с причиной и проверкой прав;
- водительские food delivery endpoints:
  - `GET /driver/food-deliveries/available`
  - `GET /driver/food-deliveries/current`
  - `POST /driver/food-deliveries/:id/claim`
  - `POST /driver/food-deliveries/:id/status`
- атомарное принятие доставки водителем через `updateMany`, чтобы один заказ не получили два водителя;
- push/WebSocket обновления статусов, цен и назначенного водителя;
- алерты администратору, если заказ не принят заведением за 5 минут или водитель не найден за 10 минут;
- админские endpoints для заведений, меню, заказов еды, назначения/переназначения водителя, промокодов, экономики и проблемных заказов;
- configurable uploads через `UPLOAD_DIR`, Render disk в `render.yaml`.

### Mobile

Основные файлы:

- `mobile/src/screens/Passenger/FoodCheckoutScreen.tsx`
- `mobile/src/screens/Passenger/FoodOrderStatusScreen.tsx`
- `mobile/src/screens/Passenger/FoodOrderHistoryScreen.tsx`
- `mobile/src/screens/Passenger/FoodHomeScreen.tsx`
- `mobile/src/screens/Passenger/RestaurantScreen.tsx`
- `mobile/src/screens/Driver/FoodDeliveriesScreen.tsx`
- `mobile/src/screens/Driver/DriverHomeScreen.tsx`
- `mobile/src/screens/Merchant/MerchantDashboardScreen.tsx`
- `mobile/src/screens/Merchant/MerchantOrdersScreen.tsx`
- `mobile/src/navigation/AppNavigator.tsx`
- `mobile/src/utils/notifications.ts`

Добавлено:

- checkout еды без WhatsApp как основного сценария;
- выбор оплаты `Наличные` / `Kaspi`;
- ввод адреса, телефона, комментария, промокода;
- отправка заказа с idempotency key;
- экран статуса заказа с полной суммой, доставкой, скидкой, причиной отмены, данными водителя и картой;
- история заказов и кнопка "Повторить";
- экран водителя "Доставка еды": доступные доставки, текущая доставка, claim, звонок, маршрут, смена статуса;
- merchant orders с новой цепочкой статусов и отменой с причиной;
- merchant dashboard с адресом, контактами, графиком, зоной/ценой доставки;
- prominent disclosure перед запросом фоновой геолокации для водителя;
- deeplink/notification routing для food order, driver food delivery и admin stalled alerts.

### Admin

Основные файлы:

- `admin/src/pages/DashboardPage.tsx`
- `admin/src/styles.css`

Добавлено:

- вкладки `Заведения`, `Заказы еды`, `Промокоды`, `Экономика`, `Проблемы`;
- создание заведений вручную;
- редактирование комиссии, бесплатного лимита, delivery fee, radius, opening/verified;
- создание категорий и блюд;
- ручное назначение и переназначение водителя;
- отмена заказа администратором;
- создание/отключение промокодов;
- учет выплат/долга партнера;
- очередь зависших/отмененных заказов.

### Документы запуска

Добавлены или обновлены:

- `docs/beta-launch-runbook.md`
- `docs/app-store-release.md`
- `docs/google-play-data-safety.md`
- `docs/store-metadata-ru.md`
- `docs/venue-strategy.md`
- `backend/.env.staging.example`
- `mobile/.env.staging.example`

В них описаны beta в Ушарале, App Store / Google Play подготовка, Data Safety, metadata, стратегия заведений, staging/production env.

## Проверки, которые уже проходили

Backend:

- `npm exec prisma generate` - проходил;
- `DATABASE_URL=postgresql://user:pass@localhost:5432/taxivillage npm exec prisma validate` - проходил;
- `npm run typecheck` - проходил;
- `npm test -- --runInBand` - проходил, 9 suites / 26 tests;
- `npm run build` - проходил.

Admin:

- `npm run typecheck` - проходил;
- `npm run lint` - проходил;
- `npm run build` - проходил после запуска вне sandbox.

Mobile:

- `npm run typecheck` - проходил;
- `npm run lint` - проходил;
- `npx expo-doctor` проходил ранее 18/18 после dedupe;
- Android Expo export проходил после добавления `babel-preset-expo`.

Не удалось проверить:

- backend e2e food flow через testcontainers, потому что Docker Desktop / docker pipe не был доступен.

Security audit после исправлений:

- backend production audit: critical 0, remaining moderate/high требуют крупных upgrades Nest/Sentry/OpenTelemetry;
- mobile production audit: critical 0, remaining mostly Expo/RN transitive toolchain;
- admin production audit: critical 0.

## Важные незакоммиченные изменения

Перед переустановкой ОС нужно обязательно залить в GitHub, иначе работа потеряется.

На момент создания этого файла `git status --short` показывает много modified/untracked файлов. Важно: не все изменения относятся только к food beta. В дереве также есть store-readiness/legal/moderation изменения, например:

- `backend/prisma/migrations/20260730090000_add_chat_moderation/`
- `backend/src/moderation/`
- `backend/scripts/provision-app-review-users.js`
- `docs/support.html`
- `docs/terms.html`
- `mobile/src/components/LegalLinks.tsx`
- `mobile/src/utils/chatSafety.ts`

Также изменен tracked файл `backend/tsconfig.tsbuildinfo`. Это build artifact, но он уже tracked в репозитории. Не удалять и не откатывать без осознанного решения.

Если нужно сохранить все перед Linux, самый безопасный вариант - один общий commit со всем текущим состоянием. Если нужно чисто разделить историю, придется вручную разнести изменения на несколько commits:

1. food delivery beta;
2. App Store / Google Play / legal readiness;
3. chat moderation / safety;
4. dependency/audit/build artifacts.

## Что осталось сделать технически

Перед настоящей beta:

- запустить Docker Desktop и прогнать backend e2e, особенно `backend/test/food-order-flow.e2e-spec.ts`;
- применить Prisma migration на копии production DB и проверить сохранность старых orders/merchants;
- проверить Render deploy с persistent disk `UPLOAD_DIR=/opt/render/project/src/backend/uploads`;
- проверить production/staging env:
  - backend API URL;
  - mobile API URL;
  - DATABASE_URL;
  - JWT secrets;
  - push credentials;
  - Maps key;
  - upload disk;
- создать reviewer/test accounts для passenger, driver, merchant, admin;
- проверить аккаунт deletion flow на реальных устройствах;
- прогнать ручные сценарии:
  - заказ наличными;
  - заказ Kaspi;
  - отказ заведения;
  - отказ/переназначение водителя;
  - плохая сеть;
  - push в фоне;
  - фоновая геолокация только когда водитель онлайн и выполняет заказ;
  - повтор заказа;
  - недоступное блюдо;
  - закрытое заведение;
  - адрес вне зоны.

Перед публичными сторами:

- подтвердить актуальные требования Apple/Google на дату подачи;
- собрать production iOS актуальным SDK;
- для Android целиться в актуальный target API;
- пройти Google closed testing минимум 12 testers / 14 дней, если аккаунт новый personal;
- подготовить video для background location;
- заполнить App Privacy / Data Safety по фактическому поведению;
- проверить privacy policy, support URL, terms, delete-account URL;
- подать iOS через TestFlight/App Review;
- подать Android через internal/closed track, потом production access.

## Что осталось сделать бизнесом

Software уже можно доводить до beta, но деньги появятся не от кода, а от операционной дисциплины.

Нужно:

- обойти 15 заведений Ушарала лично;
- подключить первые 3-5 партнеров;
- собрать меню, цены, фото, график, контакты;
- найти 5-8 водителей на доставку еды;
- провести 20 контролируемых заказов;
- потом открыть beta для 30-50 семей;
- первые 30 заказов каждого партнера делать без комиссии;
- не удерживать комиссию до регистрации ИП;
- каждый день сверять цены, отмены, acceptance time, delivery time;
- отключать блюда и партнеров, которые постоянно дают неверную доступность;
- использовать один промокод на первую доставку, например `USHARAL500`, без постоянной раздачи скидок.

Критерии успеха beta:

- 50+ выполненных заказов;
- 25+ реальных покупателей;
- 3+ активных заведения;
- 5+ водителей;
- repeat orders минимум 25%;
- отмены меньше 10%;
- 90% заказов принимаются заведением за 5 минут;
- 90% доставок завершаются не дольше 60 минут;
- нет P0/P1 сбоев.

Критерии масштабирования в следующий город:

- 8 недель подряд 200+ доставленных заказов в неделю;
- 30-day repeat минимум 35%;
- положительная маржа после скидок, выплат и поддержки;
- ручная работа владельца меньше 2 часов на 100 заказов.

## Как продолжать после переустановки на Linux

1. Установить Git, Node.js LTS, npm, Docker, Expo/EAS CLI, PostgreSQL tools.
2. Склонировать репозиторий из GitHub.
3. В корне проверить:

```bash
git status
```

4. Backend:

```bash
cd backend
npm install
npm exec prisma generate
DATABASE_URL="postgresql://user:pass@localhost:5432/taxivillage" npm exec prisma validate
npm run typecheck
npm test -- --runInBand
npm run build
```

5. Admin:

```bash
cd admin
npm install
npm run typecheck
npm run lint
npm run build
```

6. Mobile:

```bash
cd mobile
npm install
npm run typecheck
npm run lint
npx expo-doctor
```

7. Если Docker работает, прогнать e2e backend.
8. Потом уже деплоить staging/production.

## GitHub перед Linux

Минимальный безопасный путь:

```bash
git status --short
git add .
git commit -m "Implement TaxiVillage food delivery beta"
git remote -v
git push origin main
```

Перед `git add .` полезно убедиться, что в `.env` нет секретов. Примеры `.env.example` и `.env.staging.example` можно коммитить, реальные `.env` с ключами - нельзя.

Если GitHub remote еще не настроен:

```bash
git remote add origin <github-repo-url>
git push -u origin main
```

## Главная мысль будущему себе

Не пытайся сразу строить "еще один Uber Eats". Здесь сила в другом: TaxiVillage может стать локальной операционной сетью для маленьких городов. Код уже подведен к beta. Следующий самый ценный шаг - не новая фича, а 3-5 реальных заведений, 5-8 водителей и первые 50 заказов без поломок.
