#!/usr/bin/env python3
"""Bande-son du film 4 : musique (piano feutré + nappe), bruitages et voix off (Piper), mixés avec ducking.
Usage : make_audio.py <durée s> <out.wav> [préfixe voix=line] [version=4]"""
import sys, os, wave, math
import numpy as np

SR = 48000
DUR = float(sys.argv[1]); OUT = sys.argv[2]; PREFIX = sys.argv[3] if len(sys.argv) > 3 else 'line'; VER = int(sys.argv[4]) if len(sys.argv) > 4 else 4
N = int(DUR * SR)
rng = np.random.default_rng(42)

def read_wav(fn):
    with wave.open(fn) as w:
        sr = w.getframerate(); n = w.getnframes(); ch = w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    if ch > 1: a = a.reshape(-1, ch).mean(1)
    if sr != SR:
        t_old = np.arange(len(a)) / sr; t_new = np.arange(int(len(a) * SR / sr)) / SR
        a = np.interp(t_new, t_old, a).astype(np.float32)
    return a

def place(buf, sig, t, gain=1.0):
    i = max(0, int(t * SR)); j = min(N, i + len(sig))
    if i < N and j > i: buf[i:j] += sig[:j - i] * gain

# ---------- instruments ----------
def midi(n): return 440 * 2 ** ((n - 69) / 12)
def piano(freq, dur, vel=1.0):
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-t * 2.2) * (1 - np.exp(-t * 900))
    s = np.zeros_like(t)
    for k, a in enumerate([1, .45, .22, .11, .05, .025], 1):
        s += a * np.sin(2 * np.pi * freq * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * 0.6 * k)
    # feutre : filtre passe-bas simple
    s = np.convolve(s * env, np.ones(6) / 6, 'same')
    return (s * vel * 0.18).astype(np.float32)
def pad(freqs, dur, att=1.2, rel=1.5):
    t = np.arange(int(dur * SR)) / SR
    env = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, (dur - t) / rel))
    s = sum(np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.2 * t)) * (1 + 0.15 * np.sin(2 * np.pi * 5.1 * t + i)) for i, f in enumerate(freqs))
    return (s * env * 0.028).astype(np.float32)
def reverb(x, sec=1.9, wet=0.28, seed=7):
    r = np.random.default_rng(seed)
    n = int(sec * SR); ir = r.normal(0, 1, n) * np.exp(-np.arange(n) / SR * 3.2); ir[0] = 0
    ir = np.convolve(ir, np.ones(5) / 5, 'same'); ir /= np.sqrt((ir ** 2).sum()) * 6
    y = np.fft.irfft(np.fft.rfft(x, len(x) + n) * np.fft.rfft(ir, len(x) + n))[:len(x)]
    return (x + wet * y).astype(np.float32)

# ---------- musique : ré majeur, 66 bpm ----------
music = np.zeros(N, np.float32)
beat = 60 / 66; bar = 4 * beat
D, Bm, G, A = [62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]   # notes MIDI (D4 F#4 A4 …)
prog = [D, Bm, G, A, D, Bm, G, A] + ([G, A] if VER >= 5 else [])
for b, ch in enumerate(prog):
    t0 = b * bar
    if t0 > DUR - 3: break
    root = ch[0] - 12
    place(music, piano(midi(root), 3.5, .9), t0)                     # basse
    place(music, pad([midi(n) for n in ch] + [midi(root)], bar + 0.6), t0)
    # arpège en croches : 1 5 8 3 5 8 3 5
    pattern = [ch[0], ch[2], ch[0] + 12, ch[1] + 12, ch[2], ch[0] + 12, ch[1] + 12, ch[2] + 12]
    for k, n in enumerate(pattern):
        tt = t0 + k * beat / 2
        vel = 0.75 + 0.25 * (k % 2 == 0) + rng.uniform(-0.08, 0.08)
        place(music, piano(midi(n), 2.2, vel * (0.7 if k % 2 else 1)), tt + rng.uniform(-0.012, 0.012))
# accord final (ré) tenu
tf = (10 if VER >= 5 else 8) * bar
if tf < DUR - 2:
    for n in [50, 57, 62, 66, 69, 74]:
        place(music, piano(midi(n), 5.0, 0.8), tf + (n - 50) * 0.03)
    place(music, pad([midi(n) for n in [50, 57, 62, 66]], DUR - tf), tf)
music = reverb(music)
if VER == 6: music[:] = 0
# fondu de fin
fo = np.ones(N, np.float32); k = int(1.6 * SR); fo[-k:] = np.linspace(1, 0, k)
music *= fo

# ---------- bruitages ----------
sfx = np.zeros(N, np.float32)
def whoosh(dur=0.7, f0=300, f1=2400, g=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    # filtre passe-bande glissant (résonance par moyenne glissante de longueur variable)
    out = np.zeros(n); win = 24
    for i in range(0, n, 256):
        f = f0 * (f1 / f0) ** (i / n); w = max(2, int(SR / f / 2))
        seg = noise[i:i + 256]; out[i:i + 256] = np.convolve(seg, np.ones(w) / w, 'same') * 1.0
    env = np.sin(np.pi * t / dur) ** 1.5
    return (out * env * g * 4).astype(np.float32)
def pop(g=0.5):
    n = int(0.09 * SR); t = np.arange(n) / SR
    f = 420 * (2.2 ** (t / 0.09)); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45)
    return (s * g).astype(np.float32)
def tick(g=0.6):
    n = int(0.03 * SR); t = np.arange(n) / SR
    s = rng.normal(0, 1, n) * np.exp(-t * 300) * 0.5 + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 180)
    return (s * g).astype(np.float32)
def thump(g=0.5):
    n = int(0.25 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 90 * t * np.exp(-t * 4)) * np.exp(-t * 14) + rng.normal(0, 1, n) * np.exp(-t * 120) * 0.25
    return (s * g).astype(np.float32)
def shimmer(notes, dur=2.2, g=0.35):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for i, m in enumerate(notes):
        f = midi(m); d = i * 0.05
        s += (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-np.maximum(t - d, 0) * 2.0) * (t > d)
    return (s / len(notes) * g).astype(np.float32)
if VER == 6:   # film 6 : bruitages seuls, pas de musique ni de voix
    place(sfx, whoosh(), 0.15); place(sfx, whoosh(0.9, 200, 1800, .45), 9.35)
    for tt in [13.2, 16.8]: place(sfx, pop(), tt)
    for tt in [4.6, 7.4, 16.5, 17.8, 24.15]: place(sfx, tick(), tt)
    place(sfx, thump(), 8.15)
    place(sfx, shimmer([86, 90, 93, 98, 102]), 12.6)
    place(sfx, shimmer([74, 81], 1.6, .4), 27.5)
elif VER >= 5:
    place(sfx, whoosh(), 3.65); place(sfx, whoosh(0.9, 200, 1800, .45), 12.35)
    for tt in [4.9, 8.2, 11.1, 17.2, 18.6, 20.2, 21.8]: place(sfx, pop(), tt)
    for tt in [6.5, 8.0, 10.0, 22.9, 29.25]: place(sfx, tick(), tt)
    place(sfx, thump(), 10.75)
    place(sfx, shimmer([86, 90, 93, 98, 102]), 16.3)
    place(sfx, shimmer([74, 81], 1.6, .4), 30.4)
else:
    place(sfx, whoosh(), 3.65)
    place(sfx, whoosh(0.9, 200, 1800, .45), 12.35)
    for tt in [4.9, 7.0, 11.1, 17.6]: place(sfx, pop(), tt)
    for tt in [6.2, 7.7, 10.2, 19.35, 25.65]: place(sfx, tick(), tt)
    place(sfx, thump(), 10.85)
    place(sfx, shimmer([86, 90, 93, 98, 102]), 16.3)          # ré majeur aigu : l'œuvre s'accroche
    place(sfx, shimmer([74, 81], 1.6, .4), 26.8)              # coche
sfx = reverb(sfx, 1.2, 0.18, seed=3)

# ---------- voix ----------
voice = np.zeros(N, np.float32)
starts = [0.9, 4.6, 7.4, 13.6, 18.4, 22.4, 26.8, 33.0] if VER >= 5 else [0.9, 4.6, 6.9, 8.4, 13.6, 19.2, 23.6, 27.8]
for i, t0 in enumerate(starts, 1):
    fn = f'{PREFIX}{i}.wav'
    if os.path.exists(fn):
        v = read_wav(fn); v = v / (np.abs(v).max() + 1e-6) * 0.9
        # retire les silences de début/fin (> -40 dB), garde 60 ms
        nz = np.where(np.abs(v) > 0.01)[0]
        if len(nz): a0, a1 = max(0, nz[0] - int(0.06 * SR)), min(len(v), nz[-1] + int(0.12 * SR)); v = v[a0:a1]
        place(voice, v, t0)
voice = reverb(voice, 0.6, 0.08, seed=5)
# ducking de la musique sous la voix
env = np.abs(voice); k = int(0.05 * SR); env = np.convolve(env, np.ones(k) / k, 'same')
duck = np.zeros(N, np.float32); g = 0.0; a_, r_ = 1 / (0.12 * SR), 1 / (0.5 * SR)
on = (env > 0.02).astype(np.float32)
# version rapide : filtrage asymétrique par blocs de 480 échantillons (10 ms)
blk = 480; ob = on[:N // blk * blk].reshape(-1, blk).max(1); db = np.zeros_like(ob); gv = 0.0
for i, o in enumerate(ob):
    gv = gv + (o - gv) * (0.25 if o > gv else 0.045); db[i] = gv
duck = np.repeat(db, blk); duck = np.concatenate([duck, np.full(N - len(duck), duck[-1])])
music_gain = 1 - 0.6 * duck

mix = music * music_gain * 0.9 + sfx * 0.9 + voice * 1.0
# stéréo : musique légèrement élargie, voix au centre
left = music * music_gain * 0.9 * 1.0 + sfx * 0.9 + voice
right = music * music_gain * 0.9 * 0.96 + np.roll(sfx, 40) * 0.9 + voice
st = np.stack([left, right], 1)
peak = np.abs(st).max(); st = st / peak * (0.35 if VER == 6 else 0.89)
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
print(f'{OUT} : {DUR} s, crête {20*math.log10(0.89):.1f} dBFS, voix {sum(os.path.exists(f"line{i}.wav") for i in range(1,9))} lignes')
