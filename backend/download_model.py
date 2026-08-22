from huggingface_hub import snapshot_download

path = snapshot_download(repo_id="sentence-transformers/all-MiniLM-L6-v2")
print(f"Model cached at: {path}")
