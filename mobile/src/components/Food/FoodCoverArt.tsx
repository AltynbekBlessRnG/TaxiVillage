import React from 'react';
import {
  ImageBackground,
  ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

/**
 * The cover a place gets before it has uploaded a photo.
 *
 * Every merchant carries the same default `tone`, so an empty `coverImageUrl`
 * left the catalogue as a column of identical brown rectangles. This draws
 * something in their place: a colour and a dish read off the cuisine, and two
 * soft shapes so the card has depth instead of one flat fill.
 */

type Theme = {
  emoji: string;
  base: string;
  blob: string;
  glow: string;
};

const CUISINE_THEMES: Array<Theme & { keywords: string[] }> = [
  {
    keywords: ['бургер', 'burger', 'фастфуд', 'fast food'],
    emoji: '🍔',
    base: '#8A3A12',
    blob: '#F59E0B',
    glow: '#FDE68A',
  },
  {
    keywords: ['пицц', 'pizza', 'италь'],
    emoji: '🍕',
    base: '#7F1D1D',
    blob: '#EF4444',
    glow: '#FCA5A5',
  },
  {
    keywords: ['суш', 'ролл', 'sushi', 'wok', 'вок', 'япон'],
    emoji: '🍣',
    base: '#134E4A',
    blob: '#2DD4BF',
    glow: '#99F6E4',
  },
  {
    keywords: ['донер', 'шаур', 'шаверм', 'doner', 'лаваш'],
    emoji: '🌯',
    base: '#9A3412',
    blob: '#FB923C',
    glow: '#FED7AA',
  },
  {
    keywords: ['шашл', 'грил', 'grill', 'bbq', 'мангал', 'стейк'],
    emoji: '🍢',
    base: '#5B2A1F',
    blob: '#F97316',
    glow: '#FDBA74',
  },
  {
    keywords: ['кофе', 'coffee', 'кафе', 'cafe', 'чай'],
    emoji: '☕',
    base: '#3B2A20',
    blob: '#D6A77A',
    glow: '#F5E0C8',
  },
  {
    keywords: ['выпеч', 'булоч', 'пекар', 'десерт', 'dessert', 'торт', 'кондитер'],
    emoji: '🥐',
    base: '#78500F',
    blob: '#FCD34D',
    glow: '#FEF3C7',
  },
  {
    keywords: ['лапш', 'рамен', 'ramen', 'кита', 'азиат', 'asian', 'noodle'],
    emoji: '🍜',
    base: '#7C2D12',
    blob: '#FB7185',
    glow: '#FECDD3',
  },
  {
    keywords: ['салат', 'веган', 'здоров', 'salad', 'fresh'],
    emoji: '🥗',
    base: '#14532D',
    blob: '#4ADE80',
    glow: '#BBF7D0',
  },
  {
    keywords: ['плов', 'манты', 'бешбарм', 'казах', 'нацио', 'самса', 'лагман'],
    emoji: '🥘',
    base: '#78350F',
    blob: '#FBBF24',
    glow: '#FDE68A',
  },
];

/** Used when the cuisine says nothing, so two neighbours still differ. */
const NEUTRAL_THEMES: Theme[] = [
  { emoji: '🍽️', base: '#1E3A5F', blob: '#60A5FA', glow: '#BFDBFE' },
  { emoji: '🥘', base: '#4C1D95', blob: '#A78BFA', glow: '#DDD6FE' },
  { emoji: '🍲', base: '#155E75', blob: '#22D3EE', glow: '#A5F3FC' },
  { emoji: '🍛', base: '#831843', blob: '#F472B6', glow: '#FBCFE8' },
  { emoji: '🍤', base: '#3F3F46', blob: '#FDBA74', glow: '#FED7AA' },
];

function hash(seed: string) {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) % 100000;
  }
  return value;
}

export function pickCoverTheme(seed: string, ...hints: Array<string | null | undefined>): Theme {
  const haystack = hints.filter(Boolean).join(' ').toLowerCase();
  const matched = CUISINE_THEMES.find((theme) =>
    theme.keywords.some((keyword) => haystack.includes(keyword)),
  );

  if (matched) {
    return matched;
  }

  return NEUTRAL_THEMES[hash(seed) % NEUTRAL_THEMES.length];
}

type Props = {
  imageUrl?: string | null;
  seed: string;
  hints?: Array<string | null | undefined>;
  emojiSize?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  children?: React.ReactNode;
};

export const FoodCoverArt: React.FC<Props> = ({
  imageUrl,
  seed,
  hints = [],
  emojiSize = 116,
  style,
  imageStyle,
  children,
}) => {
  const theme = pickCoverTheme(seed, ...hints);

  if (imageUrl) {
    return (
      <ImageBackground source={{ uri: imageUrl }} style={style} imageStyle={imageStyle}>
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={[style, { backgroundColor: theme.base }]}>
      <View
        pointerEvents="none"
        style={[styles.blobTop, { backgroundColor: theme.blob }]}
      />
      <View
        pointerEvents="none"
        style={[styles.blobBottom, { backgroundColor: theme.glow }]}
      />
      <Text
        style={[styles.emoji, { fontSize: emojiSize, lineHeight: emojiSize * 1.16 }]}
      >
        {theme.emoji}
      </Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  blobTop: {
    position: 'absolute',
    top: '-42%',
    right: '-18%',
    width: '78%',
    aspectRatio: 1,
    borderRadius: 999,
    opacity: 0.34,
  },
  blobBottom: {
    position: 'absolute',
    bottom: '-48%',
    left: '-22%',
    width: '66%',
    aspectRatio: 1,
    borderRadius: 999,
    opacity: 0.14,
  },
  emoji: {
    position: 'absolute',
    right: 14,
    bottom: 2,
    opacity: 0.52,
    transform: [{ rotate: '-8deg' }],
  },
});
