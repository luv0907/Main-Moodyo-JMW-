import json
import os
from datetime import datetime

class JarvisMemory:
    def __init__(self, storage_path="jarvis_memory.json"):
        self.storage_path = storage_path
        self._init_storage()

    def _init_storage(self):
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, "w") as f:
                json.dump([], f)

    def store_event(self, description, category="history"):
        """Save a fact or an action (e.g., 'User opened file.pdf')"""
        event = {
            "description": description,
            "category": category,
            "timestamp": datetime.now().isoformat()
        }
        
        memory = self._load_memory()
        memory.append(event)
        
        # Keep memory concise - last 100 events
        if len(memory) > 100:
            memory = memory[-100:]
            
        with open(self.storage_path, "w") as f:
            json.dump(memory, f, indent=2)

    def _load_memory(self):
        try:
            with open(self.storage_path, "r") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []

    def recall(self, query=None, n_results=5):
        """Find the most relevant past information. Simple latest context for now."""
        memory = self._load_memory()
        
        if not query:
            return memory[-n_results:]
            
        # Simple keyword matching for "it", "that", "this"
        if any(word in query.lower() for word in ["it", "that", "this", "them"]):
            # Return the last mentioned object/file if possible
            # We look for events in the 'history' category
            relevant_events = [e for e in memory if e.get("category") == "history"]
            return relevant_events[-n_results:] if relevant_events else memory[-n_results:]

        # Basic keyword search for other queries
        query_words = query.lower().split()
        results = []
        for event in reversed(memory):
            if any(word in event["description"].lower() for word in query_words):
                results.append(event)
            if len(results) >= n_results:
                break
        
        return results if results else memory[-n_results:]