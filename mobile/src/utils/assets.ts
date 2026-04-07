import { BASE_URL } from '../api/instance';

const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

export function resolveApiAssetUrl(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/')) {
    return `${API_ORIGIN}${value}`;
  }

  return `${API_ORIGIN}/${value}`;
}
