import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.auth import models  # noqa: F401 ensures models are registered
from app.auth.routes import router as auth_router
from app.db.base import Base
from app.db.session import engine
from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
from app.mongodb.routes import router as mongodb_router


@asynccontextmanager
async def lifespan(app: FastAPI):
	# Startup
	Base.metadata.create_all(bind=engine)
	# Initialize MongoDB connection (optional, non-blocking)
	print("🔌 Attempting MongoDB Atlas connection...")
	asyncio.create_task(try_connect_mongodb())
	
	yield
	
	# Shutdown
	try:
		await close_mongodb_connection()
	except:
		pass


async def try_connect_mongodb():
	"""Try to connect to MongoDB without blocking startup"""
	try:
		await connect_to_mongodb()
	except Exception as e:
		print(f"⚠️  MongoDB connection failed: {str(e)[:150]}")
		print("   App will continue without MongoDB")


app = FastAPI(title="Security Backend", lifespan=lifespan)

allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
	CORSMiddleware,
	allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
	return {"status": "ok"}


app.include_router(auth_router, prefix="/auth")
app.include_router(mongodb_router, prefix="/api")