## Схема базы данных TaxiVillage (PostgreSQL + Prisma)

### Основные сущности

- **User**
  - Общий пользователь системы.
  - Поля:
    - `id` (String, cuid, PK)
    - `phone` (String, уникальный)
    - `email` (String, уникальный, опционально)
    - `password` (String, хэш пароля)
    - `role` (`PASSENGER` | `DRIVER` | `ADMIN`)
  - Связи:
    - `passenger` — `PassengerProfile?`
    - `driver` — `DriverProfile?`

- **PassengerProfile**
  - Профиль пассажира, один‑к‑одному с `User`.
  - Поля:
    - `id`
    - `userId` (уникальный FK → `User.id`)
    - `fullName` (опционально)
  - Связи:
    - `user` — `User`
    - `rides` — список поездок этого пассажира.

- **DriverProfile**
  - Профиль водителя, один‑к‑одному с `User`.
  - Поля:
    - `id`
    - `userId` (уникальный FK → `User.id`)
    - `fullName`
    - `status` (`PENDING` | `APPROVED` | `REJECTED`)
    - `isOnline` (флаг статуса онлайн/офлайн)
  - Связи:
    - `user` — `User`
    - `car` — `Car?`
    - `rides` — поездки, которые выполнял водитель
    - `documents` — список загруженных документов

- **Car**
  - Автомобиль, привязанный к водителю (1:1).
  - Поля:
    - `id`
    - `driverId` (уникальный FK → `DriverProfile.id`)
    - `make`, `model`, `color`, `plateNumber`

- **DriverDocument**
  - Документы водителя (права, СТС, лицензия).
  - Поля:
    - `id`
    - `driverId` (FK → `DriverProfile.id`)
    - `type` (`DRIVER_LICENSE` | `CAR_REGISTRATION` | `TAXI_LICENSE` | `OTHER`)
    - `url` (ссылка на файл в хранилище)
    - `uploadedAt`
    - `approved` (подтверждён/нет)

- **Tariff**
  - Тариф поездки.
  - Поля:
    - `id`
    - `name`
    - `baseFare` (базовая стоимость посадки)
    - `pricePerKm`
    - `pricePerMinute` (опционально)
    - `isActive`
  - Связи:
    - `rides` — поездки, выполненные по этому тарифу.

- **Ride**
  - Заказ/поездка.
  - Поля:
    - `id`
    - `passengerId` (FK → `PassengerProfile.id`)
    - `driverId` (опциональный FK → `DriverProfile.id`)
    - `tariffId` (FK → `Tariff.id`)
    - `status` (`SEARCHING_DRIVER` | `DRIVER_ASSIGNED` | `ON_THE_WAY` | `IN_PROGRESS` | `COMPLETED` | `CANCELED`)
    - Адреса и координаты:
      - `fromAddress`, `fromLat`, `fromLng`
      - `toAddress`, `toLat`, `toLng`
    - `estimatedPrice` (расчётная цена)
    - `finalPrice` (фактическая цена)
    - `startedAt`, `finishedAt`
  - Связи:
    - `passenger` — `PassengerProfile`
    - `driver` — `DriverProfile?`
    - `tariff` — `Tariff`
    - `statusHistory` — список изменений статусов.

- **RideStatusHistory**
  - История статусов поездки.
  - Поля:
    - `id`
    - `rideId` (FK → `Ride.id`)
    - `status` (`RideStatus`)
    - `createdAt`

### Примечания по расширяемости

- Для **предварительных заказов** можно будет добавить к `Ride` поле `scheduledAt` и флаг типа заказа.
- Для **рейтингов и отзывов** возможны модели:
  - `DriverRating`, `PassengerRating` с ссылками на `Ride`.
- Для **платежей** можно добавить сущности:
  - `Payment`, `PaymentMethod`, связанные с поездками и пассажирами.

