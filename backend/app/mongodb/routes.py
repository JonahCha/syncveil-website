"""
MongoDB API Routes
CRUD operations for MongoDB collections
"""
from fastapi import APIRouter, HTTPException, status, Query
from typing import List
from bson import ObjectId

from app.db.mongodb import get_mongodb
from app.mongodb.models import (
    DocumentCreate,
    DocumentUpdate,
    DocumentResponse,
    ItemCreate,
    ItemUpdate,
    ItemResponse,
)

router = APIRouter(prefix="/mongodb", tags=["MongoDB"])


# Helper function to convert ObjectId to string
def document_helper(document) -> dict:
    """Convert MongoDB document to dict with string ID"""
    if document:
        document["id"] = str(document["_id"])
        document.pop("_id", None)
    return document


# ==================== Documents Collection ====================

@router.post("/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(document: DocumentCreate):
    """Create a new document in MongoDB"""
    db = get_mongodb()
    
    document_dict = document.model_dump()
    result = await db.documents.insert_one(document_dict)
    
    created_document = await db.documents.find_one({"_id": result.inserted_id})
    return document_helper(created_document)


@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    tag: str = Query(None, description="Filter by tag")
):
    """List all documents with pagination and optional filtering"""
    db = get_mongodb()
    
    query = {}
    if tag:
        query["tags"] = tag
    
    documents = await db.documents.find(query).skip(skip).limit(limit).to_list(length=limit)
    return [document_helper(doc) for doc in documents]


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str):
    """Get a specific document by ID"""
    db = get_mongodb()
    
    if not ObjectId.is_valid(document_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document ID format"
        )
    
    document = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return document_helper(document)


@router.put("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(document_id: str, document_update: DocumentUpdate):
    """Update a document"""
    db = get_mongodb()
    
    if not ObjectId.is_valid(document_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document ID format"
        )
    
    # Only update fields that are provided
    update_data = {k: v for k, v in document_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    result = await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    updated_document = await db.documents.find_one({"_id": ObjectId(document_id)})
    return document_helper(updated_document)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str):
    """Delete a document"""
    db = get_mongodb()
    
    if not ObjectId.is_valid(document_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document ID format"
        )
    
    result = await db.documents.delete_one({"_id": ObjectId(document_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return None


# ==================== Items Collection (Example inventory) ====================

@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(item: ItemCreate):
    """Create a new item in the inventory"""
    db = get_mongodb()
    
    item_dict = item.model_dump()
    result = await db.items.insert_one(item_dict)
    
    created_item = await db.items.find_one({"_id": result.inserted_id})
    return document_helper(created_item)


@router.get("/items", response_model=List[ItemResponse])
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    category: str = Query(None, description="Filter by category"),
    in_stock: bool = Query(None, description="Filter by stock status")
):
    """List all items with pagination and optional filtering"""
    db = get_mongodb()
    
    query = {}
    if category:
        query["category"] = category
    if in_stock is not None:
        query["in_stock"] = in_stock
    
    items = await db.items.find(query).skip(skip).limit(limit).to_list(length=limit)
    return [document_helper(item) for item in items]


@router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str):
    """Get a specific item by ID"""
    db = get_mongodb()
    
    if not ObjectId.is_valid(item_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid item ID format"
        )
    
    item = await db.items.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    
    return document_helper(item)


@router.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: str, item_update: ItemUpdate):
    """Update an item"""
    db = get_mongodb()
    
    if not ObjectId.is_valid(item_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid item ID format"
        )
    
    # Only update fields that are provided
    update_data = {k: v for k, v in item_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    result = await db.items.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    
    updated_item = await db.items.find_one({"_id": ObjectId(item_id)})
    return document_helper(updated_item)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: str):
    """Delete an item"""
    db = get_mongodb()
    
    if not ObjectId.is_valid(item_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid item ID format"
        )
    
    result = await db.items.delete_one({"_id": ObjectId(item_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    
    return None


# ==================== Statistics & Utilities ====================

@router.get("/stats")
async def get_mongodb_stats():
    """Get MongoDB database statistics"""
    db = get_mongodb()
    
    documents_count = await db.documents.count_documents({})
    items_count = await db.items.count_documents({})
    
    # Get all collections
    collections = await db.list_collection_names()
    
    return {
        "database": db.name,
        "collections": collections,
        "stats": {
            "documents_count": documents_count,
            "items_count": items_count,
        }
    }


@router.get("/health")
async def mongodb_health_check():
    """Check MongoDB connection health"""
    try:
        db = get_mongodb()
        # Ping the database
        await db.command("ping")
        return {
            "status": "healthy",
            "database": db.name,
            "message": "MongoDB connection is active"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"MongoDB connection failed: {str(e)}"
        )
