from abc import ABC, abstractmethod
from typing import List, Dict, Optional

class DocumentStorage(ABC):
    @abstractmethod
    def init(self):
        pass

    @abstractmethod
    def add_folder(self, name: str, parent_id: str) -> str:
        pass

    @abstractmethod
    def delete_folder(self, folder_id: str):
        pass

    @abstractmethod
    def add_file(self, file_info: Dict):
        pass

    @abstractmethod
    def delete_file(self, file_id: str):
        pass

    @abstractmethod
    def get_folder(self, folder_id: str) -> Optional[Dict]:
        pass

    @abstractmethod
    def get_folder_children(self, folder_id: str) -> (List[Dict], List[Dict]):
        pass

    @abstractmethod
    def get_file(self, file_id: str) -> Optional[Dict]:
        pass

    @abstractmethod
    def get_stats(self) -> Dict:
        pass

    @abstractmethod
    def build_breadcrumb(self, folder_id: str) -> List[Dict]:
        pass
