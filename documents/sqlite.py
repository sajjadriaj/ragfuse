import sqlite3
import uuid
from datetime import datetime
from typing import List, Dict, Optional
from .base import DocumentStorage

class SQLiteDocumentStorage(DocumentStorage):
    def __init__(self, db_path="db/documents.db"):
        self.db_path = db_path
        self.conn = None

    def init(self):
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        c = self.conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                created_at TEXT,
                FOREIGN KEY(parent_id) REFERENCES folders(id)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                extension TEXT,
                size INTEGER,
                hash TEXT,
                folder_id TEXT,
                chunk_count INTEGER,
                created_at TEXT,
                text_length INTEGER,
                FOREIGN KEY(folder_id) REFERENCES folders(id)
            )
        """)
        # Ensure root folder exists
        c.execute("SELECT id FROM folders WHERE id = 'root'")
        if not c.fetchone():
            c.execute("INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)",
                      ('root', 'Root', None, datetime.now().isoformat()))
        self.conn.commit()

    def add_folder(self, name: str, parent_id: str) -> str:
        folder_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        c = self.conn.cursor()
        c.execute("INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)",
                  (folder_id, name, parent_id, now))
        self.conn.commit()
        return folder_id

    def delete_folder(self, folder_id: str):
        c = self.conn.cursor()
        # Delete files in this folder
        c.execute("SELECT id FROM files WHERE folder_id = ?", (folder_id,))
        file_ids = [row[0] for row in c.fetchall()]
        for file_id in file_ids:
            self.delete_file(file_id)
        # Delete subfolders recursively
        c.execute("SELECT id FROM folders WHERE parent_id = ?", (folder_id,))
        subfolder_ids = [row[0] for row in c.fetchall()]
        for sub_id in subfolder_ids:
            self.delete_folder(sub_id)
        # Delete this folder
        c.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
        self.conn.commit()

    def add_file(self, file_info: Dict):
        c = self.conn.cursor()
        c.execute("""
            INSERT INTO files (id, name, extension, size, hash, folder_id, chunk_count, created_at, text_length)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            file_info["id"], file_info["name"], file_info["extension"], file_info["size"],
            file_info["hash"], file_info["folder_id"], file_info["chunk_count"],
            file_info["created_at"], file_info["text_length"]
        ))
        self.conn.commit()

    def delete_file(self, file_id: str):
        c = self.conn.cursor()
        c.execute("DELETE FROM files WHERE id = ?", (file_id,))
        self.conn.commit()

    def get_folder(self, folder_id: str) -> Optional[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT id, name, parent_id, created_at FROM folders WHERE id = ?", (folder_id,))
        row = c.fetchone()
        if row:
            return {"id": row[0], "name": row[1], "parent": row[2], "created_at": row[3]}
        return None

    def get_folder_children(self, folder_id: str) -> (List[Dict], List[Dict]):
        c = self.conn.cursor()
        c.execute("SELECT id, name, created_at FROM folders WHERE parent_id = ?", (folder_id,))
        folders = [{"id": r[0], "name": r[1], "type": "folder", "created_at": r[2]} for r in c.fetchall()]
        c.execute("SELECT id, name, extension, size, created_at, chunk_count FROM files WHERE folder_id = ?", (folder_id,))
        files = [{"id": r[0], "name": r[1], "type": "file", "extension": r[2], "size": r[3], "created_at": r[4], "chunk_count": r[5]} for r in c.fetchall()]
        return folders, files

    def get_file(self, file_id: str) -> Optional[Dict]:
        c = self.conn.cursor()
        c.execute("SELECT * FROM files WHERE id = ?", (file_id,))
        row = c.fetchone()
        if row:
            return {
                "id": row[0], "name": row[1], "extension": row[2], "size": row[3],
                "hash": row[4], "folder_id": row[5], "chunk_count": row[6],
                "created_at": row[7], "text_length": row[8]
            }
        return None

    def get_stats(self) -> Dict:
        c = self.conn.cursor()
        c.execute("SELECT COUNT(*) FROM files")
        total_files = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM folders WHERE id != 'root'")
        total_folders = c.fetchone()[0]
        c.execute("SELECT extension, COUNT(*) FROM files GROUP BY extension")
        file_types = {row[0]: row[1] for row in c.fetchall()}
        c.execute("SELECT SUM(size) FROM files")
        total_size = c.fetchone()[0] or 0
        return {
            "total_files": total_files,
            "total_folders": total_folders,
            "file_types": file_types,
            "total_size_bytes": total_size
        }

    def build_breadcrumb(self, folder_id: str) -> List[Dict]:
        breadcrumb = []
        current_id = folder_id
        while current_id:
            f = self.get_folder(current_id)
            if not f:
                break
            breadcrumb.insert(0, {"id": f["id"], "name": f["name"]})
            current_id = f["parent"]
        return breadcrumb

    def get_all_folders_and_files(self) -> Dict[str, List[Dict]]:
        c = self.conn.cursor()
        c.execute("SELECT id, name, parent_id FROM folders")
        folders = [{"id": r[0], "name": r[1], "parent_id": r[2], "type": "folder"} for r in c.fetchall()]

        c.execute("SELECT id, name, extension, size, folder_id FROM files")
        files = [{"id": r[0], "name": r[1], "extension": r[2], "size": r[3], "folder_id": r[4], "type": "file"} for r in c.fetchall()]

        return {"folders": folders, "files": files}

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None
