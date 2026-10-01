import heroF from '../assets/hero/hero-f.webp';
import heroM from '../assets/hero/hero-m.webp';
import { useSettings } from '../store/settings';

const ART = { m: heroM, f: heroF };

/**
 * Портрет путника в диалогах: лицо скрыто капюшоном, пол — из настроек («Путник»). Рядом с портретами жителей,
 * поэтому те же пропорции 14:18 и рамка. size — высота в CSS-пикселях. mirror — отражение по горизонтали: в диалогах
 * путник стоит справа и смотрит на жителя. Картинки режет `scripts/cut-hero-portraits.py`.
 */
export function HeroPortrait({ size = 40, className = '', mirror = false }: { size?: number; className?: string; mirror?: boolean }) {
  const gender = useSettings((s) => s.heroGender);
  const width = Math.round((size * 14) / 18);
  return (
    <img
      src={ART[gender]}
      alt=""
      aria-hidden
      width={width}
      height={size}
      data-testid="hero-art"
      data-gender={gender}
      data-mirror={mirror ? '1' : undefined}
      className={`shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgb(26_15_7/0.6)] ${className}`}
      style={{ width, height: size, transform: mirror ? 'scaleX(-1)' : undefined }}
    />
  );
}
