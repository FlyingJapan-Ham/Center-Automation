-- Center Automation Database Schema

CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    shift_type TEXT NOT NULL,
    member_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, shift_type, member_name)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_date ON schedules(date);
CREATE INDEX IF NOT EXISTS idx_date_shift ON schedules(date, shift_type);
