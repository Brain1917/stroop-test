"""WSGI-точка входа для хостинга без своего сервера (например, PythonAnywhere).

Логика та же, что у server.py (см. stroop_log.py) - только транспорт другой:
вместо http.server/socketserver отдаём один WSGI-callable `application`,
который вызывает сам хостинг.
"""
import json
import mimetypes
import os

from stroop_log import APP_DIR, CSV_PATH, append_session, read_history

STATIC_FILES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/style.css": "style.css",
    "/script.js": "script.js",
}


def application(environ, start_response):
    method = environ.get("REQUEST_METHOD", "GET")
    path = environ.get("PATH_INFO", "/")

    if method == "GET" and path == "/api/history":
        return _json_response(start_response, "200 OK", read_history(CSV_PATH))

    if method == "POST" and path == "/api/log":
        length = int(environ.get("CONTENT_LENGTH") or 0)
        raw_body = environ["wsgi.input"].read(length)
        session = json.loads(raw_body)
        append_session(CSV_PATH, session)
        return _json_response(start_response, "200 OK", read_history(CSV_PATH))

    if method == "GET" and path in STATIC_FILES:
        return _static_response(start_response, STATIC_FILES[path])

    return _not_found(start_response)


def _json_response(start_response, status, payload):
    body = json.dumps(payload).encode("utf-8")
    headers = [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Content-Length", str(len(body))),
        ("Access-Control-Allow-Origin", "*"),
    ]
    start_response(status, headers)
    return [body]


def _static_response(start_response, filename):
    file_path = os.path.join(APP_DIR, filename)
    content_type, _ = mimetypes.guess_type(filename)
    with open(file_path, "rb") as f:
        body = f.read()
    headers = [
        ("Content-Type", content_type or "application/octet-stream"),
        ("Content-Length", str(len(body))),
    ]
    start_response("200 OK", headers)
    return [body]


def _not_found(start_response):
    body = b"Not found"
    start_response(
        "404 Not Found",
        [("Content-Type", "text/plain; charset=utf-8"), ("Content-Length", str(len(body)))],
    )
    return [body]
