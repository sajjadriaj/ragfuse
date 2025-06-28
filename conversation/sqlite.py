# conversation_sqlite.py
import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Optional
from .base import ConversationStorage


class SQLiteConversationStorage(ConversationStorage):
    def __init__(self, db_path="db/conversations.db"):
        self.db_path = db_path
        self.conn = None

    def init(self):
        """Initialize the SQLite database and create tables if not exists"""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                created_at TEXT,
                updated_at TEXT,
                selected_documents TEXT DEFAULT '[]'
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT,
                role TEXT,
                content TEXT,
                timestamp TEXT,
                FOREIGN KEY(conversation_id) REFERENCES conversations(id)
            )
        """)
        self.conn.commit()

    def save_conversation(self, conversation_id: str, messages: List[Dict], selected_documents: List[Dict] = None):
        """Save or update a conversation and its messages"""
        if not self.conn:
            self.init()
            
        cursor = self.conn.cursor()
        now = datetime.now().isoformat()
        
        # Convert selected_documents to JSON string
        selected_documents_json = json.dumps(selected_documents) if selected_documents is not None else '[]'

        # Upsert conversation
        cursor.execute("""
            INSERT OR REPLACE INTO conversations (id, created_at, updated_at, selected_documents)
            VALUES (?, 
                COALESCE((SELECT created_at FROM conversations WHERE id = ?), ?),
                ?,
                ?
            )
        """, (conversation_id, conversation_id, now, now, selected_documents_json))

        # Delete old messages for this conversation
        cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))

        # Insert new messages
        for msg in messages:
            cursor.execute("""
                INSERT INTO messages (conversation_id, role, content, timestamp)
                VALUES (?, ?, ?, ?)
            """, (conversation_id, msg['role'], msg['content'], msg.get('timestamp', now)))

        self.conn.commit()

    def get_all_conversations(self) -> List[Dict]:
        """Get list of all conversations with metadata and descriptive titles/previews"""
        if not self.conn:
            self.init()

        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                c.id,
                c.created_at,
                c.updated_at,
                c.selected_documents,
                (SELECT content FROM messages 
                 WHERE conversation_id = c.id 
                 AND role = 'user' 
                 ORDER BY timestamp ASC LIMIT 1) as title,
                (SELECT content FROM messages 
                 WHERE conversation_id = c.id 
                 ORDER BY timestamp DESC LIMIT 1) as last_message
            FROM conversations c
            ORDER BY c.updated_at DESC
        """)

        rows = cursor.fetchall()
        conversations = []
        for row in rows:
            title = row[4] or f"Chat from {row[1]}"
            conversations.append({
                "conversation_id": row[0],
                "created_at": row[1],
                "updated_at": row[2],
                "selected_documents": json.loads(row[3]),
                "title": title.strip(),
                "preview": (row[5] or "No messages yet").strip(),
            })
        return conversations

    def get_conversation(self, conversation_id: str) -> List[Dict]:
        """Get a conversation by ID including its messages"""
        if not self.conn:
            self.init()
            
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT role, content, timestamp FROM messages
            WHERE conversation_id = ?
            ORDER BY timestamp ASC
        """, (conversation_id,))
        
        rows = cursor.fetchall()
        return [{"role": row[0], "content": row[1], "timestamp": row[2]} for row in rows]

    def delete_conversation(self, conversation_id: str):
        """Delete a conversation and its messages"""
        if not self.conn:
            self.init()
            
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
        cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        self.conn.commit()

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None