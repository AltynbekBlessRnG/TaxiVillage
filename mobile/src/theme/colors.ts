/**
 * The app's one palette. Screens use these roles, not raw hex, so a colour
 * means the same thing everywhere and can be changed in one place.
 *
 * The app is dark-only (app.config.js sets userInterfaceStyle: 'dark').
 * Contrast is measured against bg, surfaceSunken, surface and surfaceRaised:
 * every text role clears WCAG AA (4.5:1) on all four, and every on* role
 * clears it on the fill it is named for.
 *
 * The map style (utils/mapStyle.ts) and the food illustrations
 * (components/Food/FoodCoverArt.tsx) keep their own palettes on purpose.
 */
export const colors = {
  // Surfaces, darkest to lightest.
  bg: '#09090B',
  surfaceSunken: '#111113',
  surface: '#18181B',
  // A card that must read as lifted off a surface sheet.
  surfaceElevated: '#1C1C1E',
  surfaceRaised: '#27272A',
  surfacePressed: '#3A3A40',
  // Light fill for the primary button; text on it is textInverse.
  surfaceInverse: '#F4F4F5',

  // Lines.
  border: '#27272A',
  borderStrong: '#3F3F46',

  // Text, strongest to quietest. textTertiary replaces #71717A, which fell
  // to 3.1–4.1:1 on these surfaces.
  text: '#F4F4F5',
  textMuted: '#D4D4D8',
  textSecondary: '#A1A1AA',
  textTertiary: '#8E8E96',
  textInverse: '#09090B',
  white: '#FFFFFF',

  // Primary accent: actions, links, selected state.
  accent: '#38BDF8',
  accentStrong: '#0EA5E9',
  accentText: '#7DD3FC',
  accentTextSoft: '#E0F2FE',
  accentSurface: '#082F49',
  accentBorder: '#0369A1',
  onAccent: '#04131A',

  // Taxi / pickup blue. infoStrong is the fill for white text (5.2:1);
  // white on info is only 3.7:1.
  info: '#3B82F6',
  infoStrong: '#2563EB',
  infoBorder: '#1D4ED8',
  infoText: '#60A5FA',
  infoTextSoft: '#DBEAFE',

  // Food.
  food: '#FB923C',
  foodStrong: '#F97316',
  foodText: '#FDBA74',
  foodTextSoft: '#FED7AA',
  foodSurface: '#2D160B',
  foodBorder: '#7C2D12',

  // Courier and warnings.
  warning: '#F59E0B',
  warningText: '#FCD34D',
  warningSurface: '#3F2B05',

  success: '#10B981',
  successBright: '#22C55E',
  successText: '#86EFAC',
  successSurface: '#143124',
  successBorder: '#14532D',
  onSuccess: '#062117',

  // danger is a fill and a mark; text on dark surfaces uses dangerText.
  danger: '#EF4444',
  dangerStrong: '#DC2626',
  dangerText: '#FCA5A5',
  dangerTextStrong: '#F87171',
  // Fill for a destructive confirm button; text on it is white.
  dangerDeep: '#991B1B',
  dangerSurface: '#2B1114',
  dangerBorder: '#7F1D1D',
  // Fill for a destructive button whose label is dangerText, not white.
  dangerFill: '#7F1D1D',

  highlight: '#FACC15',
  shadow: '#000000',
} as const;

export type ColorToken = keyof typeof colors;
