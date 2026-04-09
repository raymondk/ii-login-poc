#!/bin/bash
set -euo pipefail

PORT=8642
PUBLIC_KEY="dGVzdC1rZXk="
FRONTEND_URL="http://frontend.local.localhost:8000"
CALLBACK="http://127.0.0.1:$PORT/callback"
LOGIN_URL="${FRONTEND_URL}/cli-login#public_key=${PUBLIC_KEY}&callback=${CALLBACK}"

echo "Starting callback server on 127.0.0.1:$PORT..."
echo "Opening: $LOGIN_URL"
open "$LOGIN_URL"

python3 -c "
import http.server, json, sys, threading

class Handler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path != '/callback':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'OK')
        print()
        print('Delegation received:')
        try:
            print(json.dumps(json.loads(body), indent=2))
        except Exception:
            print(body.decode())
        threading.Thread(target=self.server.shutdown).start()

    def log_message(self, fmt, *args):
        pass  # silence request logs

server = http.server.HTTPServer(('127.0.0.1', $PORT), Handler)
server.serve_forever()
"
