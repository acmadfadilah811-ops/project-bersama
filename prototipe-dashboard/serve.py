"""Server lokal prototipe tanpa cache: perubahan file JS/HTML langsung terlihat saat halaman dimuat ulang.

Jalankan dari folder ini:  python serve.py  (lalu buka http://127.0.0.1:8765)
"""
import functools
import http.server
import os

PORT = 8765


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


handler = functools.partial(NoCacheHandler, directory=os.path.dirname(os.path.abspath(__file__)))
print(f"Prototipe: http://127.0.0.1:{PORT}  (kasir: /kasir.html)", flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
