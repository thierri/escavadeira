"""Servidor local para gravar o som da máquina.

1. python video/tools/som.py
2. abra no navegador:  http://localhost:8770/index.html?audio
   A página simula o vídeo inteiro, gera o som offline e envia para cá.
3. O arquivo fica em video/build/som-maquina.wav e o servidor fecha sozinho.
4. Rode python video/tools/build.py de novo para mixar o som no vídeo.
"""
import http.server
import os
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROJ = os.path.join(ROOT, "video", "project")
OUT = os.path.join(ROOT, "video", "build", "som-maquina.wav")
PORT = 8770


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=PROJ, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path != "/salvar":
            self.send_error(404)
            return
        n = int(self.headers["Content-Length"])
        data = self.rfile.read(n)
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        with open(OUT, "wb") as f:
            f.write(data)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")
        print(f"salvo: {OUT} ({len(data) / 1e6:.1f} MB)", flush=True)
        threading.Thread(target=self.server.shutdown).start()


srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
print(f"abra http://localhost:{PORT}/index.html?audio", flush=True)
srv.serve_forever()
