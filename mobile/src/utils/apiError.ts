/**
 * Turns an axios failure into a single sentence we can show to the user.
 *
 * NestJS validation errors arrive as an array of messages, and a dropped
 * connection has no response at all — both used to surface as raw noise.
 */
export function extractApiError(error: any, fallback: string): string {
  if (error?.response) {
    const serverMessage = error.response.data?.message;
    if (Array.isArray(serverMessage) && serverMessage.length > 0) {
      return String(serverMessage[0]);
    }
    if (typeof serverMessage === 'string' && serverMessage.trim()) {
      return serverMessage;
    }
    if (error.response.status === 429) {
      return 'Слишком много попыток. Подождите минуту и попробуйте снова.';
    }
    if (error.response.status >= 500) {
      return 'Сервер временно недоступен. Попробуйте через минуту.';
    }
    return fallback;
  }

  if (error?.code === 'ECONNABORTED') {
    return 'Сервер не отвечает. Проверьте интернет и попробуйте снова.';
  }

  if (error?.request) {
    return 'Нет связи с сервером. Проверьте интернет.';
  }

  return error?.message || fallback;
}
