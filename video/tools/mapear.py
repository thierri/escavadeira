"""Mostra palavras da transcrição do áudio LIMPO com o tempo correspondente no áudio ORIGINAL.

Uso: python video/tools/mapear.py <de> <ate> [<de> <ate> ...]   (tempos do áudio limpo)
Serve para achar no original o lugar exato de algo ouvido no vídeo.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
edit = json.load(open(os.path.join(ROOT, "video", "edicao.json"), encoding="utf-8"))
src = os.path.join(ROOT, edit["audio"])


def subtract(ranges, a, b):
    out = []
    for x, y in ranges:
        if b <= x or a >= y:
            out.append([x, y]); continue
        if a > x: out.append([x, a])
        if b < y: out.append([b, y])
    return out


keep = [[edit["inicio"], edit["fim"]]]
for c in edit.get("cortes", []):
    keep = subtract(keep, c["de"], c["ate"])
p = edit.get("pausas", {})
if p:
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", src, "-af", f"silencedetect=noise={p.get('limite_db', -38)}dB:d=0.45", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    st = [float(m) for m in re.findall(r"silence_start: ([0-9.]+)", r.stderr)]
    en = [float(m) for m in re.findall(r"silence_end: ([0-9.]+)", r.stderr)]
    for a, b in zip(st, en):
        if b - a > p["maxima"]:
            keep = subtract(keep, a + p["alvo"] / 2, b - p["alvo"] / 2)
keep = [[a, b] for a, b in keep if b - a > 0.05]


def orig_t(c):
    acc = 0.0
    for a, b in keep:
        if c <= acc + (b - a):
            return a + (c - acc)
        acc += b - a
    return keep[-1][1]


def clean_t(t):
    acc = 0.0
    for a, b in keep:
        if t < a:
            return acc
        if t <= b:
            return acc + (t - a)
        acc += b - a
    return acc


# --video t1 t2 ...: tempo no vídeo → tempo no áudio original
if len(sys.argv) > 1 and sys.argv[1] == "--video":
    for x in sys.argv[2:]:
        print(f"vídeo {float(x):7.2f} → original {orig_t(float(x)):7.2f}")
    sys.exit(0)

# modo inverso: --orig t1 t2 ... → tempo no áudio limpo (= tempo no vídeo)
if len(sys.argv) > 1 and sys.argv[1] == "--orig":
    for x in sys.argv[2:]:
        print(f"original {float(x):7.2f} → vídeo {clean_t(float(x)):7.2f}")
    sys.exit(0)

d = json.load(open(os.path.join(ROOT, "video", "build", "transcricao-limpa.json"), encoding="utf-8"))
words = [w for s in d["segments"] for w in s["words"]]
args = [float(x) for x in sys.argv[1:]]
for i in range(0, len(args), 2):
    lo, hi = args[i], args[i + 1]
    print(f"--- limpo {lo}–{hi}")
    print(" ".join(f"{w['w']}@{orig_t(w['s']):.2f}" for w in words if lo <= w["s"] <= hi))
