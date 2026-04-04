import { Linking } from 'react-native';

type WhatsAppOrderParams = {
  restaurantName: string;
  phone: string;
  items: Array<{ name: string; price: string; qty: number }>;
  address: string;
  comment?: string;
  total: number;
};

function sanitizePhone(phone: string) {
  return phone.replace(/[^\d]/g, '');
}

export function buildWhatsAppOrderMessage({
  restaurantName,
  items,
  address,
  comment,
  total,
}: Omit<WhatsAppOrderParams, 'phone'>) {
  const hasItems = items.length > 0;
  const lines = items.map(
    (item, index) => `${index + 1}. ${item.name} x${item.qty} — ${Math.round(Number(item.price) * item.qty)} тг`,
  );

  return [
    `Здравствуйте! ${hasItems ? `Хочу оформить заказ в ${restaurantName}.` : `Хочу уточнить меню и оформить заказ в ${restaurantName}.`}`,
    '',
    hasItems ? 'Состав заказа:' : null,
    ...(hasItems ? lines : []),
    hasItems ? '' : null,
    hasItems ? `Итого по блюдам: ${Math.round(total)} тг` : null,
    address ? `Адрес доставки: ${address}` : null,
    comment?.trim() ? `Комментарий: ${comment.trim()}` : null,
  ].filter(Boolean).join('\n');
}

export async function openWhatsAppOrder(params: WhatsAppOrderParams) {
  const phone = sanitizePhone(params.phone);
  if (!phone) {
    return false;
  }

  const text = encodeURIComponent(
    buildWhatsAppOrderMessage({
      restaurantName: params.restaurantName,
      items: params.items,
      address: params.address,
      comment: params.comment,
      total: params.total,
    }),
  );

  const url = `whatsapp://send?phone=${phone}&text=${text}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    return false;
  }

  await Linking.openURL(url);
  return true;
}
