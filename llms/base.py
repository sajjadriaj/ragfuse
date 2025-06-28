from abc import ABC, abstractmethod
from typing import List, Dict

class LLM(ABC):
    @abstractmethod
    def generate_response(self, prompt: str, context: List[str]) -> str:
        pass
