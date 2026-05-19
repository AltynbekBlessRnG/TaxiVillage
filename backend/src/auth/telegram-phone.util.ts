export function normalizeTelegramPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `7${digits}`;
  }

  return digits;
}

export function phonesMatch(appPhone: string, telegramPhone: string): boolean {
  return normalizeTelegramPhone(appPhone) === normalizeTelegramPhone(telegramPhone);
}
