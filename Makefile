PORT ?= 8010

.PHONY: serve
serve:
	@printf '%s\n' \
		'import http.server' \
		'import os' \
		'import socketserver' \
		'' \
		'PORT = int(os.environ.get("PORT", "8010"))' \
		'' \
		'class NoCacheHandler(http.server.SimpleHTTPRequestHandler):' \
		'    def send_head(self):' \
		'        for header in ("If-Modified-Since", "If-None-Match"):' \
		'            del self.headers[header]' \
		'        return super().send_head()' \
		'' \
		'    def end_headers(self):' \
		'        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")' \
		'        self.send_header("Pragma", "no-cache")' \
		'        self.send_header("Expires", "0")' \
		'        super().end_headers()' \
		'' \
		'socketserver.TCPServer.allow_reuse_address = True' \
		'with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:' \
		'    print(f"Serving http://localhost:{PORT}/ (uncached)")' \
		'    httpd.serve_forever()' \
	| PORT=$(PORT) python3 -
