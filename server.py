#!/usr/bin/env python3
import http.server
import json
import os
import socketserver
import webbrowser

from stroop_log import APP_DIR, CSV_PATH, append_session, read_history

PORT = 8765


class StroopRequestHandler(http.server.SimpleHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/history":
            self._send_json(200, read_history(CSV_PATH))
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/log":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length)
        session = json.loads(raw_body)
        append_session(CSV_PATH, session)
        self._send_json(200, read_history(CSV_PATH))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


def main():
    os.chdir(APP_DIR)
    try:
        httpd = socketserver.TCPServer(("127.0.0.1", PORT), StroopRequestHandler)
    except OSError:
        print(
            f"Порт {PORT} уже занят. Похоже, сервер уже запущен - "
            f"открой http://localhost:{PORT} в браузере."
        )
        return

    url = f"http://localhost:{PORT}"
    print(f"Струп-тест запущен: {url}")
    print("Останови сервер комбинацией Ctrl+C")
    webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("Сервер остановлен.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
