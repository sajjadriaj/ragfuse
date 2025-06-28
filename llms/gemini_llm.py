from llms.base import LLM
from typing import List
import os
import google.generativeai as genai

class GeminiLLM(LLM):
    def __init__(self, api_key: str, model: str = "gemini-pro"):
        genai.configure(api_key=api_key)
        self.model = model

    def generate_response(self, prompt: str, context: List[str]) -> str:
        model = genai.GenerativeModel(self.model)
        
        full_prompt = "You are a helpful assistant. Use the following context to answer the user's question.\n\n"
        if context:
            full_prompt += "Context:\n" + "\n".join(context) + "\n\n"
        full_prompt += "Question: " + prompt

        try:
            response = model.generate_content(full_prompt)
            return response.text
        except Exception as e:
            return f"Error from Gemini: {e}"

