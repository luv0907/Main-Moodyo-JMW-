from abc import ABC, abstractmethod
from typing import Any

class BaseModule(ABC):
    @abstractmethod
    def initialize(self) -> None:
        pass

class BaseSTT(BaseModule):
    @abstractmethod
    def listen(self) -> str:
        pass

class BaseTTS(BaseModule):
    @abstractmethod
    def speak(self, text: str) -> None:
        pass

class BaseMemory(BaseModule):
    @abstractmethod
    def store(self, description: str, category: str = "history") -> None:
        pass

    @abstractmethod
    def recall(self, query: str = None, n_results: int = 5) -> Any:
        pass

    @abstractmethod
    def get_recent(self, n: int = 10) -> list[str]:
        pass

class BaseLLMProvider(BaseModule):
    @abstractmethod
    def query(self, prompt: str) -> Any:
        pass
