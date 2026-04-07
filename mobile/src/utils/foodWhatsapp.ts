import { Linking } from 'react-native';

type WhatsAppOrderParams = {
  restaurantName: string;
  phone: string;
  items: Array<{ name: string; price: string; qty: number }>;
  address: string;
  comment?: string;
  total: number;
  orderId?: string;
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
  orderId,
}: Omit<WhatsAppOrderParams, 'phone'>) {
  const hasItems = items.length > 0;
  const lines = items.map(
    (item, index) => `${index + 1}. ${item.name} x${item.qty} — ${Math.round(Number(item.price) * item.qty)} тг`,
  );
  const orderLink = orderId ? `taxivillage://merchant-orders/${orderId}` : null;

  return [
    `Здравствуйте! ${hasItems ? `Хочу сделать заказ в ${restaurantName}.` : `Хочу уточнить меню и оформить заказ в ${restaurantName}.`}`,
    '',
    hasItems ? 'Состав заказа:' : null,
    ...(hasItems ? lines : []),
    hasItems ? '' : null,
    hasItems ? `Итого по блюдам: ${Math.round(total)} тг` : null,
    address ? `Адрес доставки: ${address}` : null,
    comment?.trim() ? `Комментарий: ${comment.trim()}` : null,
    orderLink ? `Ссылка на заказ в приложении: ${orderLink}` : null,
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
        orderId: params.orderId,
      }),
  );

  const appUrl = `whatsapp://send?phone=${phone}&text=${text}`;
  const webUrl = `https://wa.me/${phone}?text=${text}`;

  const canOpenApp = await Linking.canOpenURL(appUrl);
  if (canOpenApp) {
    await Linking.openURL(appUrl);
    return true;
  }

  const canOpenWeb = await Linking.canOpenURL(webUrl);
  if (!canOpenWeb) {
    return false;
  }

  await Linking.openURL(webUrl);
  return true;
}
