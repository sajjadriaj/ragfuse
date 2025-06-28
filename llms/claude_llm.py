from llms.base import LLM
from typing import List
import os
import anthropic

class ClaudeLLM(LLM):
    def __init__(self, api_key: str, model: str = "claude-3-sonnet-20240229"):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def generate_response(self, prompt: str, context: List[str]) -> str:
        system_message = "You are a helpful assistant. Use the following context to answer the user's question."
        if context:
            system_message += "\n\nContext:\n" + "\n".join(context)

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system_message,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            return message.content[0].text
        except Exception as e:
            return f"Error from Claude: {e}"
