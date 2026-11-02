"""Transcreve a narração com faster-whisper, guardando o tempo de cada palavra.

Uso: python video/tools/transcribe.py narracao.m4a video/build/transcricao.json [modelo]
"""
import json
import os
import subprocess
import sys
import time

import numpy as np
from faster_whisper import WhisperModel

src, dst = sys.argv[1], sys.argv[2]
model_name = sys.argv[3] if len(sys.argv) > 3 else "medium"

# decodifica com o ffmpeg (16 kHz, mono, float32): evita incompatibilidades do PyAV
ffmpeg = os.environ.get("FFMPEG", "ffmpeg")
raw = subprocess.run([ffmpeg, "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                     check=True, capture_output=True).stdout
audio = np.frombuffer(raw, dtype=np.float32)

t0 = time.time()
model = WhisperModel(model_name, device="cpu", compute_type="int8")
segments, info = model.transcribe(
    audio,
    language="pt",
    word_timestamps=True,
    vad_filter=False,          # mantém pausas e repetições: queremos ver tudo o que foi falado
    condition_on_previous_text=False,  # evita "pular" trechos repetidos
    beam_size=5,
)

out = {"duration": info.duration, "segments": []}
for s in segments:
    out["segments"].append({
        "start": s.start, "end": s.end, "text": s.text.strip(),
        "words": [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)} for w in (s.words or [])],
    })
    print(f"[{s.start:7.2f} → {s.end:7.2f}] {s.text.strip()}", flush=True)

with open(dst, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(f"\nduração do áudio: {info.duration:.1f} s · tempo de transcrição: {time.time() - t0:.0f} s")
