# conversation_db_interface.py
from abc import ABC, abstractmethod
from typing import List, Dict, Optional

class ConversationStorage(ABC):
    @abstractmethod
    def init(self):
        """Initialize the database or storage system"""
        pass

    @abstractmethod
    def save_conversation(self, conversation_id: str, messages: List[Dict]):
        """Save or update a conversation with its messages"""
        pass

    @abstractmethod
    def get_all_conversations(self) -> List[Dict]:
        """Get list of all conversations"""
        pass

    @abstractmethod
    def get_conversation(self, conversation_id: str) -> List[Dict]:
        """Get a specific conversation by ID"""
        pass

    @abstractmethod
    def delete_conversation(self, conversation_id: str):
        """Delete a conversation by ID"""
        pass