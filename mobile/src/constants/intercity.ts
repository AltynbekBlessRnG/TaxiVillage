export const INTERCITY_CITIES = [
  'Алматы',
  'Астана',
  'Шымкент',
  'Караганда',
  'Тараз',
  'Талдыкорган',
  'Конаев',
  'Алаколь',
  'Капчагай',
  'Семей',
  'Павлодар',
  'Усть-Каменогорск',
  'Кызылорда',
  'Туркестан',
  'Актау',
  'Актобе',
  'Атырау',
  'Костанай',
  'Кокшетау',
  'Петропавловск',
  'Уральск',
  'Жезказган',
  'Балхаш',
  'Сарыагаш',
] as const;

const weekdayFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
});

const dateLabelFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

const dateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildIntercityDateOptions = (days = 10) =>
  Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const shortWeekday = weekdayFormatter.format(date).replace('.', '');
    return {
      value: dateValue(date),
      label: `${dateLabelFormatter.format(date)} • ${shortWeekday}`,
    };
  });

export const INTERCITY_TIME_OPTIONS = [
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
  '23:00',
] as const;

export const formatIntercityDateTime = (isoLike?: string | null) => {
  if (!isoLike) {
    return 'Не указано';
  }
  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) {
    return isoLike;
  }
  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const composeIntercityDepartureAt = (date: string, time: string) => {
  const parsed = new Date(`${date}T${time || '00:00'}`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Укажите корректные дату и время');
  }
  return parsed.toISOString();
};
