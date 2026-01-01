"""
MongoDB Connection Management
Async MongoDB driver using Motor
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional

from app.core.config import get_settings

settings = get_settings()


class MongoDB:
    """MongoDB connection manager"""
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


mongodb = MongoDB()


async def connect_to_mongodb():
    """Initialize MongoDB connection"""
    import certifi
    import ssl
    
    try:
        # Create SSL context for dev environments with certificate issues
        mongodb.client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000
        )
        mongodb.db = mongodb.client[settings.MONGODB_DB_NAME]
        
        # Test connection with timeout
        await asyncio.wait_for(
            mongodb.client.admin.command('ping'),
            timeout=5.0
        )
        print(f"✅ Connected to MongoDB Atlas: {settings.MONGODB_DB_NAME}")
    except Exception as e:
        print(f"⚠️  MongoDB Atlas connection failed: {str(e)[:200]}")
        print("   This is expected in some development environments.")
        print("   The app will work, but MongoDB endpoints will be unavailable.")
        mongodb.client = None
        mongodb.db = None


async def close_mongodb_connection():
    """Close MongoDB connection"""
    if mongodb.client:
        mongodb.client.close()
        print("✅ MongoDB connection closed")


def get_mongodb() -> AsyncIOMotorDatabase:
    """Get MongoDB database instance"""
    if mongodb.db is None:
        raise RuntimeError("MongoDB is not initialized. Call connect_to_mongodb() first.")
    return mongodb.db
