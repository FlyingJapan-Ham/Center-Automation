from __future__ import annotations

import json
import os
from pathlib import Path
from threading import Lock

from flask import (
    Flask,
    abort,
    jsonify,
    request,
    send_from_directory,
)

BASE_DIR = Path(__file__).parent.resolve()
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "schedule.json"
FILE_LOCK = Lock()

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")


def ensure_data_file() -> None:
    """Create the data directory/file if they do not exist yet."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        DATA_FILE.write_text("{}", encoding="utf-8")


def load_schedule() -> dict:
    """Read the latest schedule snapshot from disk."""
    ensure_data_file()
    with FILE_LOCK:
        try:
            raw = DATA_FILE.read_text(encoding="utf-8") or "{}"
            return json.loads(raw)
        except json.JSONDecodeError:
            # Reset corrupt file so the UI can keep working.
            DATA_FILE.write_text("{}", encoding="utf-8")
            return {}


def save_schedule(payload: dict) -> None:
    """Persist the given schedule JSON to disk."""
    ensure_data_file()
    with FILE_LOCK:
        DATA_FILE.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


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
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")


if __name__ == "__main__":
    main()
