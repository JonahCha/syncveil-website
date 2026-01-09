"""
MongoDB Pydantic Models/Schemas
These are schemas for data validation, not ORM models
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, info):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")


class DocumentBase(BaseModel):
    """Base model for MongoDB documents"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    tags: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentCreate(DocumentBase):
    """Schema for creating a new document"""
    pass


class DocumentUpdate(BaseModel):
    """Schema for updating a document"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    tags: Optional[list[str]] = None
    metadata: Optional[dict] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentInDB(DocumentBase):
    """Schema for document stored in database"""
    id: str = Field(alias="_id")
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )


class DocumentResponse(DocumentBase):
    """Schema for document response"""
    id: str
    
    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={ObjectId: str}
    )


# Example: Item model for a simple inventory system
class ItemBase(BaseModel):
    """Base model for items"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    price: float = Field(..., gt=0)
    quantity: int = Field(..., ge=0)
    category: str
    in_stock: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ItemCreate(ItemBase):
    """Schema for creating a new item"""
    pass


class ItemUpdate(BaseModel):
    """Schema for updating an item"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    quantity: Optional[int] = Field(None, ge=0)
    category: Optional[str] = None
    in_stock: Optional[bool] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ItemInDB(ItemBase):
    """Schema for item stored in database"""
    id: str = Field(alias="_id")
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )


class ItemResponse(ItemBase):
    """Schema for item response"""
    id: str
    
    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={ObjectId: str}
    )
