"""Трек темы из сгенерированной записи: public/music/<тема>.ogg и точки кольца в src/audio/tracks.json.

    python3 scripts/build-music.py city путь/к/записи.mp3 [--loop 19.64 97.41]

Запись с генератора начинается вступлением и кончается затуханием. Скрипт ищет два места с одинаковой гармонией
(хрома-признаки по 6 секунд): кольцо идёт от первого ко второму, вступление звучит один раз. Перед концом кольца
вклеивается плавный переход в начало кольца (полторы секунды), поэтому шва не слышно, хотя запись не повторяется
точно. Громкость приводится к -18 LUFS одним множителем, без компрессии, чтобы не менять звук у шва.

Нужен ffmpeg с libopus: из PATH или из переменной FFMPEG (подходит статический из пакета imageio-ffmpeg).
Промты треков — docs/design/music-prompt.md.
"""

import argparse
import json
import os
import re
import subprocess
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
SR = 48000
FADE = 1.5
TARGET_LUFS = -18.0
THEMES = ['city', 'land1', 'land2', 'land3', 'land4', 'land5', 'vault']


def decode(path: str) -> np.ndarray:
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-map', '0:a', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def chroma(mono: np.ndarray, sr: int, hop: int, n: int) -> np.ndarray:
    frames = np.lib.stride_tricks.sliding_window_view(mono, n)[::hop] * np.hanning(n)
    spec = np.abs(np.fft.rfft(frames, axis=1))
    freqs = np.fft.rfftfreq(n, 1 / sr)
    ok = (freqs > 60) & (freqs < 4000)
    pc = (np.round(12 * np.log2(freqs[ok] / 440)) % 12).astype(int)
    c = np.stack([spec[:, ok][:, pc == k].sum(1) for k in range(12)], axis=1)
    return c / (np.linalg.norm(c, axis=1, keepdims=True) + 1e-9)


def find_loop(audio: np.ndarray) -> tuple[float, float]:
    """Начало кольца в первых 30 секундах, конец — не раньше 40% записи и не ближе 8 секунд к концу."""
    sr = SR // 2
    mono = audio.mean(1)[::2]
    hop, n = 512, 4096
    c = chroma(mono, sr, hop, n)
    fps = sr / hop
    w = int(6 * fps)
    dur = len(mono) / sr
    blocks = np.lib.stride_tricks.sliding_window_view(c, (w, 12))[:, 0].reshape(-1, w * 12)
    starts = np.arange(int(FADE * fps) + 1, int(min(30, dur / 3) * fps), 2)
    ends = np.arange(int(max(dur * 0.4, 45) * fps), int((dur - 8) * fps) - w, 2)
    sim = blocks[starts] @ blocks[ends].T / w
    i, j = np.unravel_index(np.argmax(sim), sim.shape)
    print(f'сходство {sim[i, j]:.3f}')
    return starts[i] / fps, ends[j] / fps


def loudness(path: str) -> float:
    out = subprocess.run([FFMPEG, '-hide_banner', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('theme', choices=THEMES)
    ap.add_argument('source')
    ap.add_argument('--loop', nargs=2, type=float, metavar=('START', 'END'))
    args = ap.parse_args()

    audio = decode(args.source)
    start, end = args.loop or find_loop(audio)
    s, e, f = int(start * SR), int(end * SR), int(FADE * SR)
    out = audio[:e].copy()
    # Равномощный переход: хвост кольца уходит, звук перед его началом входит, после прыжка звук продолжается.
    t = np.linspace(0, np.pi / 2, f, dtype=np.float32)[:, None]
    out[e - f:e] = audio[e - f:e] * np.cos(t) + audio[s - f:s] * np.sin(t)

    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'loop.f32')
        out.astype(np.float32).tofile(wav)
        pcm = ['-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', wav]
        mid = os.path.join(tmp, 'mid.wav')
        subprocess.run([FFMPEG, '-v', 'error', '-y', *pcm, mid], check=True)
        gain = TARGET_LUFS - loudness(mid)
        dest = os.path.join(ROOT, 'public', 'music', f'{args.theme}.ogg')
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        subprocess.run([FFMPEG, '-v', 'error', '-y', *pcm, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.95:level=false',
                        '-c:a', 'libopus', '-b:a', '96k', '-vbr', 'on', dest], check=True)

    meta_path = os.path.join(ROOT, 'src', 'audio', 'tracks.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    meta[args.theme] = {'loopStart': round(start, 4), 'loopEnd': round(end, 4)}
    meta = {k: meta[k] for k in THEMES if k in meta}
    with open(meta_path, 'w') as fh:
        json.dump(meta, fh, indent=2)
        fh.write('\n')
    print(f'{args.theme}: кольцо {start:.2f}–{end:.2f} с, {os.path.getsize(dest) // 1024} КБ, громкость {gain:+.1f} дБ')


if __name__ == '__main__':
    main()
