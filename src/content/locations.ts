import type { LocationId, LocationMeta } from './schema';

// Порядок массива = порядок в сетке города и рост цены.
export const LOCATIONS: LocationMeta[] = [
  { id: 'cafe', ru: 'Кафе', emoji: '☕', unlockCost: 0 },
  { id: 'market', ru: 'Рынок', emoji: '🍅', unlockCost: 60 },
  { id: 'supermarket', ru: 'Супермаркет', emoji: '🛒', unlockCost: 80 },
  { id: 'restaurant', ru: 'Ресторан', emoji: '🍽️', unlockCost: 100 },
  { id: 'home', ru: 'Дом', emoji: '🏠', unlockCost: 120 },
  { id: 'park', ru: 'Парк', emoji: '🌳', unlockCost: 150 },
  { id: 'clothes', ru: 'Магазин одежды', emoji: '👕', unlockCost: 180 },
  { id: 'pharmacy', ru: 'Аптека', emoji: '💊', unlockCost: 200 },
  { id: 'school', ru: 'Школа', emoji: '🏫', unlockCost: 230 },
  { id: 'post', ru: 'Почта', emoji: '📮', unlockCost: 260 },
  { id: 'bank', ru: 'Банк', emoji: '🏦', unlockCost: 290 },
  { id: 'barber', ru: 'Парикмахерская', emoji: '💈', unlockCost: 320 },
  { id: 'gym', ru: 'Спортзал', emoji: '🏋️', unlockCost: 350 },
  { id: 'station', ru: 'Вокзал', emoji: '🚉', unlockCost: 380 },
  { id: 'beach', ru: 'Пляж', emoji: '🏖️', unlockCost: 410 },
  { id: 'office', ru: 'Офис', emoji: '💼', unlockCost: 450 },
  { id: 'hotel', ru: 'Отель', emoji: '🏨', unlockCost: 490 },
  { id: 'hospital', ru: 'Больница', emoji: '🏥', unlockCost: 530 },
  { id: 'airport', ru: 'Аэропорт', emoji: '✈️', unlockCost: 570 },
  { id: 'police', ru: 'Полиция', emoji: '🚓', unlockCost: 600 },
];

export const LOCATION_BY_ID = Object.fromEntries(LOCATIONS.map((l) => [l.id, l])) as Record<
  LocationId,
  LocationMeta
>;
