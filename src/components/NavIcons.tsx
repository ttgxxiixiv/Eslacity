import { PixelArt } from './PixelArt';

// Иконки нижнего меню, 16×16. K — контур, остальные буквы — цвета из палитры рисунка.

const MAP = [
  '.KK..........KK.',
  'KppK........KppK',
  'KpPKKKKKKKKKKpPK',
  'KpPKPPPPPPPPKpPK',
  'KpPKPCPPPPPPKpPK',
  'KpPKCCCPPRPPKpPK',
  'KpPKPCPPRPPPKpPK',
  'KpPKPPPRPPPPKpPK',
  'KpPKPPRPPPPPKpPK',
  'KpPKPRPPPXPXKpPK',
  'KpPKPPRRPPXPKpPK',
  'KpPKPPPPRXPXKpPK',
  'KpPKKKKKKKKKKpPK',
  'KppK........KppK',
  '.KK..........KK.',
  '................',
];

// Книга с золотой «Ñ» на обложке.
const BOOK = [
  '..KKKKKKKKKKKK..',
  '.KdBBBBBBBBBBBK.',
  '.KdBGBBBBBBBGBK.',
  '.KdBBBBGGGBBBBK.',
  '.KdBBBBBBBBBBBK.',
  '.KdBBBGBBBGBBBK.',
  '.KdBBBGGBBGBBBK.',
  '.KdBBBGBGBGBBBK.',
  '.KdBBBGBBGGBBBK.',
  '.KdBBBGBBBGBBBK.',
  '.KdBBBBBBBBBBBK.',
  '.KdBGBBBBBBBGBK.',
  '.KdWWWWWWWWWWWK.',
  '.KdwwwwwwwwwwwK.',
  '..KKKKKKuKKKKK..',
  '........u.......',
];

const HOURGLASS = [
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
  '..KKKKKKKKKKKK..',
  '...KgSSSSSSgK...',
  '...KggSSSSggK...',
  '....KggSSggK....',
  '.....KggggK.....',
  '......KSSK......',
  '.....KggSgK.....',
  '....KgggSggK....',
  '...KgggSSSggK...',
  '...KgSSSSSSgK...',
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
  '..KKKKKKKKKKKK..',
  '................',
];

// Герой из карты города, 12×16.
const HERO = [
  '....KKKK....',
  '...KGGGGK...',
  '..KGGGGGGKK.',
  '.KGGGGGGGGGK',
  '.KHSSSSSSHK.',
  '.KSSKSSKSSK.',
  '..KSSSSSSK..',
  '...KKSSKK...',
  '..KGGGGGGK..',
  '.KSGGBBGGSK.',
  '.KSGGGGGGSK.',
  '..KGGGGGGK..',
  '..KgGKKGgK..',
  '..KBBK.KBBK.',
  '..KBBK.KBBK.',
  '...KK...KK..',
];

export const NAV_ICONS = {
  map: {
    rows: MAP,
    colors: { K: '#3b2a1a', P: '#f3dca4', p: '#d6b06a', C: '#6b4a2a', R: '#b0452a', X: '#c0392b' },
  },
  book: {
    rows: BOOK,
    colors: { K: '#2a1a10', B: '#8a4a2a', d: '#5e2f18', G: '#f0c23c', W: '#f4ecd8', w: '#d8ccb0', u: '#3b6fd1' },
  },
  hourglass: {
    rows: HOURGLASS,
    colors: { K: '#2a1a10', W: '#9a5a2e', g: '#bfe3f2', S: '#e3bf6e' },
  },
  hero: {
    rows: HERO,
    colors: { K: '#1a120a', G: '#3f9a2f', g: '#2a6420', S: '#f2c28a', H: '#d49a2a', B: '#6b4423' },
  },
} as const;

export type NavIconName = keyof typeof NAV_ICONS;

export function NavIcon({ name, size }: { name: NavIconName; size: number }) {
  const icon = NAV_ICONS[name];
  return <PixelArt rows={[...icon.rows]} colors={icon.colors} size={size} />;
}
