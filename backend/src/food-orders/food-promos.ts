export type FoodPromoDefinition = {
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  minTotal?: number;
  merchantIds?: string[];
};

export const FOOD_PROMOS: FoodPromoDefinition[] = [
  {
    code: 'FIRST10',
    kind: 'percent',
    value: 10,
    minTotal: 3000,
  },
  {
    code: 'DINNER1500',
    kind: 'fixed',
    value: 1500,
    minTotal: 7000,
  },
  {
    code: 'ALMATYFOOD',
    kind: 'percent',
    value: 15,
    minTotal: 5000,
  },
];

export function resolveFoodPromo(
  promoCode: string | undefined,
  merchantId: string,
  total: number,
): { code: string; discountAmount: number } | null {
  if (!promoCode?.trim()) {
    return null;
  }

  const normalizedCode = promoCode.trim().toUpperCase();
  const promo = FOOD_PROMOS.find((entry) => entry.code === normalizedCode);
  if (!promo) {
    return null;
  }

  if (promo.minTotal && total < promo.minTotal) {
    return null;
  }

  if (promo.merchantIds?.length && !promo.merchantIds.includes(merchantId)) {
    return null;
  }

  const rawDiscount =
    promo.kind === 'percent' ? Math.round((total * promo.value) / 100) : promo.value;
  const discountAmount = Math.max(0, Math.min(rawDiscount, total));

  return {
    code: normalizedCode,
    discountAmount,
  };
}
