import csv
import os

APP_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(APP_DIR, "results_log.csv")

CSV_FIELDS = [
    "timestamp",
    "duration_sec",
    "total_trials",
    "correct",
    "incorrect",
    "accuracy_pct",
    "avg_rt_ms",
    "avg_rt_congruent_ms",
    "avg_rt_incongruent_ms",
    "interference_ms",
]


def append_session(csv_path, session):
    file_exists = os.path.exists(csv_path)
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if not file_exists:
            writer.writeheader()
        writer.writerow({field: session.get(field, "") for field in CSV_FIELDS})


def read_history(csv_path):
    if not os.path.exists(csv_path):
        return []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return [_row_to_session(row) for row in reader]


def _row_to_session(row):
    return {
        "timestamp": row["timestamp"],
        "duration_sec": _parse_float(row["duration_sec"]),
        "total_trials": int(row["total_trials"]),
        "correct": int(row["correct"]),
        "incorrect": int(row["incorrect"]),
        "accuracy_pct": _parse_float(row["accuracy_pct"]),
        "avg_rt_ms": _parse_float(row["avg_rt_ms"]),
        "avg_rt_congruent_ms": _parse_optional_float(row["avg_rt_congruent_ms"]),
        "avg_rt_incongruent_ms": _parse_optional_float(row["avg_rt_incongruent_ms"]),
        "interference_ms": _parse_optional_float(row["interference_ms"]),
    }


def _parse_float(value):
    return float(value)


def _parse_optional_float(value):
    if value is None or value == "":
        return None
    return float(value)
