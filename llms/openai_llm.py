from llms.base import LLM
from typing import List
import os
from openai import OpenAI

class OpenAILLM(LLM):
    def __init__(self, api_key: str, model: str = "gpt-3.5-turbo"):
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def generate_response(self, prompt: str, context: List[str]) -> str:
        messages = []
        if context:
            messages.append({"role": "system", "content": "You are a helpful assistant. Use the following context to answer the user's question."})
            for chunk in context:
                messages.append({"role": "system", "content": chunk})
        messages.append({"role": "user", "content": prompt})

        try:
            chat_completion = self.client.chat.completions.create(
                messages=messages,
                model=self.model,
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            return f"Error from OpenAI: {e}"
