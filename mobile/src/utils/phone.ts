/**
 * Phone helpers for Kazakh numbers.
 *
 * People here type their number in every possible shape: `87051234567`,
 * `7051234567`, `+7 705 123 45 67`. The API expects a single E.164 string, so
 * the UI keeps a formatted value for the user and sends a normalized one.
 */

const NATIONAL_LENGTH = 10;

/** Digits after the `+7` country code, at most 10 of them. */
export function extractNationalDigits(input: string): string {
  let digits = input.replace(/\D/g, '');

  // `8` and `7` are both used as the trunk/country prefix in everyday writing.
  if (digits.startsWith('8')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('7') && digits.length > NATIONAL_LENGTH) {
    digits = digits.slice(1);
  }

  return digits.slice(0, NATIONAL_LENGTH);
}

/** Display value for the input field: `+7 705 123 45 67`. */
export function formatPhoneInput(input: string): string {
  const digits = extractNationalDigits(input);
  if (!digits) {
    return '';
  }

  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ].filter(Boolean);

  return `+7 ${parts.join(' ')}`;
}

/** E.164 value for the API: `+77051234567`. Empty when incomplete. */
export function toE164(input: string): string {
  const digits = extractNationalDigits(input);
  return digits.length === NATIONAL_LENGTH ? `+7${digits}` : '';
}

export function isCompletePhone(input: string): boolean {
  return extractNationalDigits(input).length === NATIONAL_LENGTH;
}
