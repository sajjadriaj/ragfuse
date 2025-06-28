from llms.base import LLM
from typing import List
import requests
import json

class OllamaLLM(LLM):
    def __init__(self, endpoint: str = "http://localhost:11434", model: str = "llama2"):
        self.endpoint = endpoint
        self.model = model

    def generate_response(self, prompt: str, context: List[str]) -> str:
        full_prompt = "You are a helpful assistant. Use the following context to answer the user's question.\n\n"
        if context:
            full_prompt += "Context:\n" + "\n".join(context) + "\n\n"
        full_prompt += "Question: " + prompt

        try:
            response = requests.post(f"{self.endpoint}/api/generate", json={
                "model": self.model,
                "prompt": full_prompt,
                "stream": False
            })
            response.raise_for_status()
            return response.json()["response"]
        except requests.exceptions.RequestException as e:
            return f"Error connecting to Ollama: {e}"
        except json.JSONDecodeError:
            return "Error: Invalid JSON response from Ollama"
        except Exception as e:
            return f"Error from Ollama: {e}"

