import csv
import os
import tempfile
import unittest

from stroop_log import CSV_FIELDS, append_session, read_history

SAMPLE_SESSION = {
    "timestamp": "2026-07-11T10:00:00",
    "duration_sec": 60,
    "total_trials": 40,
    "correct": 35,
    "incorrect": 5,
    "accuracy_pct": 87.5,
    "avg_rt_ms": 650.2,
    "avg_rt_congruent_ms": 520.1,
    "avg_rt_incongruent_ms": 700.4,
    "interference_ms": 180.3,
}


class AppendAndReadHistoryTest(unittest.TestCase):
    def setUp(self):
        fd, self.csv_path = tempfile.mkstemp(suffix=".csv")
        os.close(fd)
        os.remove(self.csv_path)

    def tearDown(self):
        if os.path.exists(self.csv_path):
            os.remove(self.csv_path)

    def test_read_history_returns_empty_list_when_file_missing(self):
        self.assertEqual(read_history(self.csv_path), [])

    def test_append_session_then_read_history_round_trips_single_session(self):
        append_session(self.csv_path, SAMPLE_SESSION)

        history = read_history(self.csv_path)

        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["total_trials"], 40)
        self.assertEqual(history[0]["correct"], 35)
        self.assertAlmostEqual(history[0]["accuracy_pct"], 87.5)
        self.assertAlmostEqual(history[0]["interference_ms"], 180.3)

    def test_append_session_twice_accumulates_two_rows_in_order(self):
        second_session = dict(SAMPLE_SESSION, timestamp="2026-07-11T11:00:00", correct=38)

        append_session(self.csv_path, SAMPLE_SESSION)
        append_session(self.csv_path, second_session)

        history = read_history(self.csv_path)

        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["timestamp"], "2026-07-11T10:00:00")
        self.assertEqual(history[1]["timestamp"], "2026-07-11T11:00:00")
        self.assertEqual(history[1]["correct"], 38)

    def test_append_session_writes_header_row_matching_csv_fields(self):
        append_session(self.csv_path, SAMPLE_SESSION)

        with open(self.csv_path, newline="", encoding="utf-8") as f:
            header = next(csv.reader(f))

        self.assertEqual(header, CSV_FIELDS)

    def test_read_history_handles_session_with_no_congruent_trials(self):
        session_without_congruent = dict(
            SAMPLE_SESSION,
            avg_rt_congruent_ms="",
            interference_ms="",
        )
        append_session(self.csv_path, session_without_congruent)

        history = read_history(self.csv_path)

        self.assertIsNone(history[0]["avg_rt_congruent_ms"])
        self.assertIsNone(history[0]["interference_ms"])


if __name__ == "__main__":
    unittest.main()
