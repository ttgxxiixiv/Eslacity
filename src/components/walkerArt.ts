import type { CloakId } from '../config';
import moss from '../assets/home/road-walker.webp';
import crimson from '../assets/home/road-walker-crimson.webp';
import gold from '../assets/home/road-walker-gold.webp';
import indigo from '../assets/home/road-walker-indigo.webp';
import night from '../assets/home/road-walker-night.webp';

/** Путник в плаще каждого цвета: картинки строит scripts/build-road-art.py. */
export const WALKER: Record<CloakId, string> = { moss, crimson, indigo, night, gold };
