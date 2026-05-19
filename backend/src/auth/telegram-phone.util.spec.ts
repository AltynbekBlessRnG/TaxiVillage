import { normalizeTelegramPhone, phonesMatch } from './telegram-phone.util';

describe('telegram-phone util', () => {
  it('normalizes local kazakh numbers to country-code format', () => {
    expect(normalizeTelegramPhone('+7 776 741 54 10')).toBe('77767415410');
    expect(normalizeTelegramPhone('8 (776) 741-54-10')).toBe('77767415410');
    expect(normalizeTelegramPhone('7767415410')).toBe('77767415410');
  });

  it('matches equivalent phone formats', () => {
    expect(phonesMatch('+7 776 741 54 10', '8 (776) 741-54-10')).toBe(true);
    expect(phonesMatch('+7 776 741 54 10', '+7 701 000 00 00')).toBe(false);
  });
});
