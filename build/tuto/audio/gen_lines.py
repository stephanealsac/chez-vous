#!/usr/bin/env python3
"""Voix off avec Chatterbox (multilingue, CPU). Usage : gen_lines.py <lines.txt> <ref.wav|none> <préfixe>"""
import sys, time, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
lines = [l.strip() for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
ref = None if sys.argv[2] == 'none' else sys.argv[2]
prefix = sys.argv[3]
model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
for i, text in enumerate(lines, 1):
    t0 = time.time()
    wav = model.generate(text, language_id="fr", audio_prompt_path=ref, exaggeration=0.4, cfg_weight=0.5, temperature=0.6)
    ta.save(f"{prefix}{i}.wav", wav, model.sr)
    print(i, round(wav.shape[-1] / model.sr, 2), 's', round(time.time() - t0), 's calc', text)
