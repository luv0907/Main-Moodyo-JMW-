import json
import os
from datetime import datetime
from typing import Any, List
from jarvis.modules.base import BaseMemory
from jarvis.config import settings
from jarvis.utils.logger import logger

class SemanticMemory(BaseMemory):
    def __init__(self):
        self.storage_path = settings.MEMORY_FILE
        self.memory_limit = settings.MEMORY_LIMIT
        self.memory: List[dict] = []

    def initialize(self) -> None:
        logger.info(f"Initializing Semantic Memory with storage: {self.storage_path}")
        if not os.path.exists(self.storage_path):
            self._save_memory([])
        self.memory = self._load_memory()

    def store(self, description: str, category: str = "history") -> None:
        event = {
            "description": description,
            "category": category,
            "timestamp": datetime.now().isoformat()
        }
        self.memory.append(event)
        
        if len(self.memory) > self.memory_limit:
            self.memory = self.memory[-self.memory_limit:]
            
        self._save_memory(self.memory)
        logger.debug(f"Stored event: {description}")

    def recall(self, query: str = None, n_results: int = 5) -> Any:
        if not query:
            return self.memory[-n_results:]
            
        # Basic keyword search (placeholder for real semantic search)
        query_words = query.lower().split()
        results = []
        for event in reversed(self.memory):
            if any(word in event["description"].lower() for word in query_words):
                results.append(event)
            if len(results) >= n_results:
                break
        
        return results if results else self.memory[-n_results:]

    def get_recent(self, n: int = 10) -> List[str]:
        return [m["description"] for m in self.memory[-n:]]

    def _load_memory(self) -> List[dict]:
        try:
            with open(self.storage_path, "r") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []

    def _save_memory(self, memory: List[dict]) -> None:
        with open(self.storage_path, "w") as f:
            json.dump(memory, f, indent=2)
