from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from threading import Lock
from contextlib import contextmanager

from flask import (
    Flask,
    abort,
    jsonify,
    request,
    send_from_directory,
)

BASE_DIR = Path(__file__).parent.resolve()
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "schedule.json"  # Legacy JSON file for migration
DB_FILE = DATA_DIR / "schedule.db"
FILE_LOCK = Lock()

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")


@contextmanager
def get_db():
    """Get database connection with context manager."""
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initialize the database with schema."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                shift_type TEXT NOT NULL,
                member_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, shift_type, member_name)
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_date ON schedules(date)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_date_shift ON schedules(date, shift_type)
        """)


def migrate_json_to_db() -> None:
    """Migrate existing JSON data to SQLite if JSON file exists."""
    if not DATA_FILE.exists():
        return

    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not data:
            return

        with get_db() as conn:
            for date, shifts in data.items():
                for shift_type, members in shifts.items():
                    for member_name in members:
                        try:
                            conn.execute("""
                                INSERT OR IGNORE INTO schedules (date, shift_type, member_name)
                                VALUES (?, ?, ?)
                            """, (date, shift_type, member_name))
                        except sqlite3.Error:
                            continue

        # Backup JSON file
        backup_file = DATA_FILE.with_suffix('.json.bak')
        DATA_FILE.rename(backup_file)
        print(f"Migrated JSON data to SQLite. Backup: {backup_file}")

    except Exception as e:
        print(f"Migration error: {e}")


def load_schedule() -> dict:
    """Load schedule from SQLite database."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT date, shift_type, member_name
            FROM schedules
            ORDER BY date, shift_type
        """).fetchall()

    schedule = {}
    for row in rows:
        date = row['date']
        shift_type = row['shift_type']
        member_name = row['member_name']

        if date not in schedule:
            schedule[date] = {'morning': [], 'afternoon': []}

        if shift_type not in schedule[date]:
            schedule[date][shift_type] = []

        schedule[date][shift_type].append(member_name)

    return schedule


def save_schedule(payload: dict) -> None:
    """Save schedule to SQLite database."""
    with get_db() as conn:
        # Clear existing schedules
        conn.execute("DELETE FROM schedules")

        # Insert new schedules
        for date, shifts in payload.items():
            for shift_type, members in shifts.items():
                for member_name in members:
                    conn.execute("""
                        INSERT OR IGNORE INTO schedules (date, shift_type, member_name)
                        VALUES (?, ?, ?)
                    """, (date, shift_type, member_name))


@app.before_request
def prevent_data_leak():
    """Block direct access to the data directory."""
    if request.path.startswith("/data"):
        abort(404)


@app.get("/api/schedule")
def get_schedule():
    return jsonify(load_schedule())


@app.put("/api/schedule")
def put_schedule():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    save_schedule(payload)
    return jsonify({"ok": True})


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/<path:asset_path>")
def static_files(asset_path: str):
    if asset_path.startswith("data/"):
        abort(404)
    return send_from_directory(app.static_folder, asset_path)


@app.get("/api/health")
def health_check():
    return jsonify({"status": "ok"})


def main() -> None:
    # Initialize database
    init_db()
    # Migrate JSON data if exists
    migrate_json_to_db()

    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")


# Initialize DB on import (for Gunicorn)
init_db()
migrate_json_to_db()


if __name__ == "__main__":
    main()
