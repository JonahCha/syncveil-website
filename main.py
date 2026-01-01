from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# Create the FastAPI app instance
app = FastAPI(
    title="SyncVeil Website",
    description="Serves the static frontend for SyncVeil.",
    version="1.0.0"
)

# Mount the current directory "." to serve static files.
# The `html=True` argument tells FastAPI to automatically serve `index.html`
# for directory routes (like the root path '/') and allows access to other .html files.
app.mount("/", StaticFiles(directory=".", html=True), name="static")