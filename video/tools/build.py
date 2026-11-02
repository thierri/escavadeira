"""Monta o projeto HyperFrames do vídeo a partir da narração gravada.

Lê video/edicao.json (a "lista de edição") e:
  1. corta a narração original, mantendo só os trechos de "manter" (com fades curtos
     nas emendas), e grava video/project/narracao.m4a;
  2. converte os tempos do áudio original para o áudio limpo;
  3. calcula início e duração de cada cena e os pontos de sincronia (warp);
  4. copia o simulador (css + js) para video/project/app e gera index.html,
     timeline.js e os arquivos do HyperFrames.

Uso: python video/tools/build.py
Precisa do ffmpeg no PATH (ou na variável FFMPEG).
"""
import json
import os
import re
import shutil
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VID = os.path.join(ROOT, "video")
PROJ = os.path.join(VID, "project")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
HF_VERSION = "0.9.3"
FPS = 30

edit = json.load(open(os.path.join(VID, "edicao.json"), encoding="utf-8"))
src = os.path.join(ROOT, edit["audio"])
FADE = 0.012


def subtract(ranges, a, b):
    """Remove o intervalo [a, b] de uma lista de intervalos."""
    out = []
    for x, y in ranges:
        if b <= x or a >= y:
            out.append([x, y])
            continue
        if a > x:
            out.append([x, a])
        if b < y:
            out.append([b, y])
    return out


def silences(path, db, min_d):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", path, "-af", f"silencedetect=noise={db}dB:d={min_d}", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    st = [float(m) for m in re.findall(r"silence_start: ([0-9.]+)", r.stderr)]
    en = [float(m) for m in re.findall(r"silence_end: ([0-9.]+)", r.stderr)]
    return list(zip(st, en))


if "manter" in edit:                        # lista pronta de trechos
    keep = edit["manter"]
else:                                       # início/fim + cortes de repetições + pausas encurtadas
    keep = [[edit["inicio"], edit["fim"]]]
    for c in edit.get("cortes", []):
        keep = subtract(keep, c["de"], c["ate"])
    p = edit.get("pausas", {})
    if p:
        half = p["alvo"] / 2
        for a, b in silences(src, p.get("limite_db", -38), 0.45):
            if b - a > p["maxima"]:
                keep = subtract(keep, a + half, b - half)
    keep = [[round(a, 3), round(b, 3)] for a, b in keep if b - a > 0.05]

# ---------- 1. áudio limpo ----------
os.makedirs(PROJ, exist_ok=True)
parts, labels = [], []
for i, (a, b) in enumerate(keep):
    d = b - a
    parts.append(
        f"[0:a]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d={FADE},afade=t=out:st={max(0, d - FADE):.3f}:d={FADE}[s{i}]"
    )
    labels.append(f"[s{i}]")
filt = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(keep)}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]"
out_audio = os.path.join(PROJ, "narracao.m4a")
subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src, "-filter_complex", filt,
                "-map", "[out]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", out_audio], check=True)

# ---------- 2. tempo original → tempo limpo ----------
def clean_t(t):
    acc = 0.0
    for a, b in keep:
        if t < a:
            return acc                      # caiu num trecho cortado: gruda no começo do próximo
        if t <= b:
            return acc + (t - a)
        acc += b - a
    return acc

audio_len = sum(b - a for a, b in keep)

# ---------- 3. cenas ----------
scenes = edit["cenas"]                      # [{cena, inicio, sync: [[t_original, t_roteiro], ...]}, ...]
LEAD = edit.get("antecipar", 0.35)          # a cena entra um pouco antes da fala
TAIL = edit.get("final", 2.5)               # segura a última imagem depois da fala
starts = []
for i, s in enumerate(scenes):
    starts.append(0.0 if i == 0 else max(0.0, clean_t(s["inicio"]) - LEAD))
total = audio_len + TAIL
tl = []
for i, s in enumerate(scenes):
    st = starts[i]
    en = starts[i + 1] if i + 1 < len(scenes) else total
    warp = [[round(clean_t(a) - st, 3), b] for a, b in s.get("sync", [])]
    tl.append({"scene": s["cena"], "start": round(st, 3), "dur": round(en - st, 3), "warp": warp})
total = round(total, 3)

# ---------- 4. projeto HyperFrames ----------
# o simulador vai para uma pasta com nome novo a cada build (app-<versão>): assim o
# navegador do Studio nunca usa módulos antigos guardados em cache
import time
APP = f"app-{int(time.time())}"
for old in os.listdir(PROJ):
    if old == "app" or old.startswith("app-"):
        shutil.rmtree(os.path.join(PROJ, old))
app = os.path.join(PROJ, APP)
shutil.copytree(os.path.join(ROOT, "js"), os.path.join(app, "js"))
shutil.copytree(os.path.join(ROOT, "css"), os.path.join(app, "css"))
drv = open(os.path.join(VID, "src", "driver.js"), encoding="utf-8").read()
drv = drv.replace("./app/", f"./{APP}/").replace("./timeline.js", f"./timeline.js?v={APP}")
open(os.path.join(PROJ, "driver.js"), "w", encoding="utf-8").write(drv)

with open(os.path.join(PROJ, "timeline.js"), "w", encoding="utf-8") as f:
    f.write("// Gerado por video/tools/build.py: não edite à mão.\n")
    f.write("export default " + json.dumps({"fps": FPS, "total": total, "scenes": tl}, ensure_ascii=False, indent=1) + ";\n")

# som da máquina (gravado por video/tools/som.py): abaixa sozinho quando a narração fala
maq_src = os.path.join(VID, "build", "som-maquina.wav")
maq_tag = ""
if os.path.exists(maq_src):
    maq_vol = edit.get("volume_maquina_db", -26)
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", maq_src, "-i", out_audio, "-filter_complex",
                    f"[0:a]aresample=48000,loudnorm=I={maq_vol}:TP=-3:LRA=11[m];[1:a]aresample=48000[v];"
                    "[m][v]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=500:makeup=1[out]",
                    "-map", "[out]", "-c:a", "aac", "-b:a", "160k", "-t", f"{total:.3f}",
                    os.path.join(PROJ, "som-maquina.m4a")], check=True)
    maq_tag = (f'\n    <audio id="maquina" src="som-maquina.m4a" data-start="0" data-duration="{total}"\n'
               f'           data-track-index="3" data-volume="1"></audio>')

# palco do simulador, copiado do index.html do app
page = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
body = re.search(r"<body>(.*)</body>", page, re.S).group(1)
body = re.sub(r"\s*<script[^>]*></script>\s*", "\n", body)
body = body.replace('<div id="stage">',
                    f'<div id="stage" data-composition-id="sim" data-start="0" data-duration="{total}" '
                    f'data-track-index="0" data-no-timeline>', 1)

html = f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1920, height=1080">
  <title>Escavadeira hidráulica · vídeo</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{APP}/css/style.css">
  <style>
    html, body {{ margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #12161f; }}
    #root {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; }}
  </style>
</head>
<body>
  <!-- Gerado por video/tools/build.py: não edite à mão. -->
  <div id="root" data-composition-id="main" data-start="0" data-duration="{total}"
       data-width="1920" data-height="1080" data-fps="{FPS}" data-no-timeline>
{body}
    <audio id="narracao" src="narracao.m4a" data-start="0" data-duration="{audio_len:.3f}"
           data-track-index="2" data-volume="1"></audio>{maq_tag}
  </div>
  <script type="module" src="driver.js?v={APP}"></script>
</body>
</html>
"""
open(os.path.join(PROJ, "index.html"), "w", encoding="utf-8").write(html)

json.dump({"$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
           "paths": {"blocks": "compositions", "components": "compositions/components", "assets": "assets"},
           "media": {"autoProxy": True}},
          open(os.path.join(PROJ, "hyperframes.json"), "w", encoding="utf-8"), indent=2)
json.dump({"id": "escavadeira-video", "name": "escavadeira-video"},
          open(os.path.join(PROJ, "meta.json"), "w", encoding="utf-8"), indent=2)
json.dump({"name": "escavadeira-video", "private": True, "type": "module",
           "scripts": {"dev": f"npx --yes hyperframes@{HF_VERSION} preview",
                       "check": f"npx --yes hyperframes@{HF_VERSION} check",
                       "render": f"npx --yes hyperframes@{HF_VERSION} render"}},
          open(os.path.join(PROJ, "package.json"), "w", encoding="utf-8"), indent=2)

print(f"áudio limpo: {audio_len:.1f} s (original cortado em {len(keep)} trechos)")
print("som da máquina: " + ("incluído" if maq_tag else "ainda não gravado (rode video/tools/som.py)"))
print(f"vídeo: {total:.1f} s, {len(tl)} cenas")
for s in tl:
    print(f"  cena {s['scene'] + 1:2d}: {s['start']:7.2f} s  +{s['dur']:6.2f} s  sync={len(s['warp'])}")
