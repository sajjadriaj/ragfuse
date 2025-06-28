# download_models.py
"""
Script to pre-download ChromaDB embedding models during Docker build
"""

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

def download_models():
    print("Pre-downloading embedding models...")
    
    try:
        # Create a temporary client to trigger model download
        client = chromadb.Client()
        
        # Define the embedding function with a specific model
        embedding_function = SentenceTransformerEmbeddingFunction(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        # Create collection with the specified embedding function
        collection = client.create_collection(
            name="temp_collection",
            embedding_function=embedding_function
        )
        
        # Add a dummy document to trigger model download
        collection.add(
            documents=["This is a test document to trigger model download"],
            ids=["test_id"]
        )
        
        print("✅ Models downloaded successfully!")
        
    except Exception as e:
        print(f"⚠️  Model download completed with: {e}")
        
    finally:
        # Clean up temporary collection
        try:
            client.delete_collection("temp_collection")
            print("🧹 Cleaned up temporary collection")
        except:
            pass

if __name__ == "__main__":
    download_models()