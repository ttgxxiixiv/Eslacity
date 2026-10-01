import type { CloakId } from '../config';
import brocade from '../assets/home/road-walker-brocade.webp';
import broadcloth from '../assets/home/road-walker-broadcloth.webp';
import homespun from '../assets/home/road-walker-homespun.webp';
import leather from '../assets/home/road-walker-leather.webp';
import linen from '../assets/home/road-walker-linen.webp';
import sackcloth from '../assets/home/road-walker-sackcloth.webp';
import silk from '../assets/home/road-walker-silk.webp';
import velvet from '../assets/home/road-walker-velvet.webp';

/** Путник в каждой накидке, по порядку материалов: картинки строит scripts/build-road-art.py. */
export const WALKER: Record<CloakId, string> = { sackcloth, homespun, linen, broadcloth, leather, velvet, silk, brocade };
