from huggingface_hub import snapshot_download

# Kept in sync with config.py's EMBEDDING_MODEL by hand rather than imported -
# importing config.py here would require DB/Gemini env vars to be present at
# BUILD time (this script runs in Render's build step), which isn't guaranteed.
path = snapshot_download(repo_id="sentence-transformers/all-MiniLM-L6-v2")
print(f"Model cached at: {path}")
