import sqlite3
import json
from typing import Dict, Optional

class LLMSettingsStorage:
    def __init__(self, db_path="db/llm_settings.db"):
        self.db_path = db_path
        self.conn = None

    def init(self):
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        c = self.conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS llm_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        self.conn.commit()

    def save_setting(self, key: str, value: str):
        if not self.conn:
            self.init()
        c = self.conn.cursor()
        c.execute("INSERT OR REPLACE INTO llm_settings (key, value) VALUES (?, ?)", (key, value))
        self.conn.commit()

    def get_setting(self, key: str) -> Optional[str]:
        if not self.conn:
            self.init()
        c = self.conn.cursor()
        c.execute("SELECT value FROM llm_settings WHERE key = ?", (key,))
        result = c.fetchone()
        return result[0] if result else None

    def get_all_settings(self) -> Dict[str, str]:
        if not self.conn:
            self.init()
        c = self.conn.cursor()
        c.execute("SELECT key, value FROM llm_settings")
        return {row[0]: row[1] for row in c.fetchall()}

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None
