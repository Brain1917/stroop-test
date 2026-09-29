import io
import json
import os
import unittest

import stroop_log
import wsgi_app


def call_app(method, path, body=None):
    raw_body = b"" if body is None else json.dumps(body).encode("utf-8")
    environ = {
        "REQUEST_METHOD": method,
        "PATH_INFO": path,
        "CONTENT_LENGTH": str(len(raw_body)),
        "wsgi.input": io.BytesIO(raw_body),
    }
    captured = {}

    def start_response(status, headers):
        captured["status"] = status
        captured["headers"] = dict(headers)

    response_body = b"".join(wsgi_app.application(environ, start_response))
    return captured["status"], captured["headers"], response_body


class WsgiAppTest(unittest.TestCase):
    def setUp(self):
        self.csv_path = stroop_log.CSV_PATH
        if os.path.exists(self.csv_path):
            os.remove(self.csv_path)

    def tearDown(self):
        if os.path.exists(self.csv_path):
            os.remove(self.csv_path)

    def test_get_root_serves_index_html(self):
        status, headers, body = call_app("GET", "/")

        self.assertTrue(status.startswith("200"))
        self.assertIn("text/html", headers["Content-Type"])
        self.assertIn(b"<html", body.lower())

    def test_get_script_js_serves_javascript_with_correct_content_type(self):
        status, headers, body = call_app("GET", "/script.js")

        self.assertTrue(status.startswith("200"))
        self.assertIn("javascript", headers["Content-Type"])
        self.assertGreater(len(body), 0)

    def test_get_api_history_returns_empty_list_when_no_sessions_logged(self):
        status, headers, body = call_app("GET", "/api/history")

        self.assertTrue(status.startswith("200"))
        self.assertEqual(json.loads(body), [])

    def test_post_api_log_appends_session_and_returns_updated_history(self):
        session = {
            "timestamp": "2026-07-11T10:00:00",
            "duration_sec": 60,
            "total_trials": 10,
            "correct": 8,
            "incorrect": 2,
            "accuracy_pct": 80.0,
            "avg_rt_ms": 600.0,
            "avg_rt_congruent_ms": 500.0,
            "avg_rt_incongruent_ms": 650.0,
            "interference_ms": 150.0,
        }

        status, _, body = call_app("POST", "/api/log", session)

        self.assertTrue(status.startswith("200"))
        history = json.loads(body)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["correct"], 8)

        status, _, body = call_app("GET", "/api/history")
        self.assertEqual(len(json.loads(body)), 1)

    def test_unknown_path_returns_404(self):
        status, _, _ = call_app("GET", "/does-not-exist")

        self.assertTrue(status.startswith("404"))


if __name__ == "__main__":
    unittest.main()
