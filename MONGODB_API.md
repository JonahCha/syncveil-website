# MongoDB API Documentation

## Overview

This project includes MongoDB Atlas integration for flexible, document-based storage suitable for unstructured or semi-structured data.

## Setup for Production (Railway)

### 1. MongoDB Atlas Setup (Required)

MongoDB Atlas is the recommended cloud database for production deployment.

1. Create a free account at https://www.mongodb.com/cloud/atlas/register
2. Create a free M0 cluster (or use existing cluster)
3. Create a database user with read/write permissions
4. Whitelist your IP or allow access from anywhere (0.0.0.0/0)
5. Get your connection string (mongodb+srv://...)

### 2. Configuration

Set the following environment variable in Railway:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=syncveil
```

**Important:**
- `MONGO_URI` must be a MongoDB Atlas connection string (mongodb+srv://)
- Never use `mongodb://localhost` in production
- The app will fail to start if MONGO_URI is invalid or unreachable

### 3. Dependencies

MongoDB dependencies are included in `requirements.txt`:
- `motor==3.3.2` - Async MongoDB driver
- `pymongo==4.6.1` - MongoDB Python driver
- `certifi` - SSL certificate validation

## Local Development Setup (Optional)

For local development, you can either:

**Option A: Use MongoDB Atlas (Recommended)**
```env
MONGO_URI=mongodb+srv://your-atlas-connection-string
MONGO_DB_NAME=syncveil_dev
```

**Option B: Skip MongoDB entirely**
```env
# Don't set MONGO_URI - app will work without MongoDB features
```

## API Endpoints

All MongoDB endpoints are prefixed with `/api/mongodb`

### Health & Status
#### Check MongoDB Health
```http
GET /api/mongodb/health
```

Response:
```json
{
  "status": "healthy",
  "database": "syncveil",
  "message": "MongoDB connection is active"
}
```

#### Get Database Statistics
```http
GET /api/mongodb/stats
```

Response:
```json
{
  "database": "syncveil",
  "collections": ["documents", "items"],
  "stats": {
    "documents_count": 5,
    "items_count": 10
  }
}
```

### Documents Collection

Generic document storage with flexible schema.

#### Create Document
```http
POST /api/mongodb/documents
Content-Type: application/json

{
  "name": "My Document",
  "description": "Document description",
  "tags": ["important", "project-a"],
  "metadata": {
    "author": "John Doe",
    "version": "1.0"
  }
}
```

#### List Documents
```http
GET /api/mongodb/documents?skip=0&limit=10&tag=important
```

Query Parameters:
- `skip` (optional): Number of documents to skip (default: 0)
- `limit` (optional): Maximum documents to return (default: 10, max: 100)
- `tag` (optional): Filter by tag

#### Get Single Document
```http
GET /api/mongodb/documents/{document_id}
```

#### Update Document
```http
PUT /api/mongodb/documents/{document_id}
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description",
  "tags": ["updated", "v2"]
}
```

Note: Only provided fields will be updated.

#### Delete Document
```http
DELETE /api/mongodb/documents/{document_id}
```

### Items Collection (Inventory Example)

Example inventory/catalog system with structured schema.

#### Create Item
```http
POST /api/mongodb/items
Content-Type: application/json

{
  "name": "Laptop",
  "description": "High-performance laptop",
  "price": 999.99,
  "quantity": 10,
  "category": "Electronics",
  "in_stock": true
}
```

#### List Items
```http
GET /api/mongodb/items?category=Electronics&in_stock=true&skip=0&limit=10
```

Query Parameters:
- `skip` (optional): Number of items to skip
- `limit` (optional): Maximum items to return
- `category` (optional): Filter by category
- `in_stock` (optional): Filter by stock status (true/false)

#### Get Single Item
```http
GET /api/mongodb/items/{item_id}
```

#### Update Item
```http
PUT /api/mongodb/items/{item_id}
Content-Type: application/json

{
  "price": 899.99,
  "quantity": 8,
  "in_stock": true
}
```

#### Delete Item
```http
DELETE /api/mongodb/items/{item_id}
```

## Testing the API

### 1. Using the Web Interface

Open the test page in your browser:
```
http://localhost:5500/test-mongodb.html
```

This provides a user-friendly interface to test all MongoDB endpoints.

### 2. Using cURL

```bash
# Check health
curl http://localhost:8000/api/mongodb/health

# Create a document
curl -X POST http://localhost:8000/api/mongodb/documents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Document",
    "description": "Testing MongoDB API",
    "tags": ["test", "demo"]
  }'

# List documents
curl http://localhost:8000/api/mongodb/documents

# Create an item
curl -X POST http://localhost:8000/api/mongodb/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smartphone",
    "description": "Latest model",
    "price": 699.99,
    "quantity": 15,
    "category": "Electronics",
    "in_stock": true
  }'

# List items
curl http://localhost:8000/api/mongodb/items
```

### 3. Using the API Documentation

Visit the interactive API docs:
```
http://localhost:8000/docs
```

Look for endpoints under the "MongoDB" tag.

## Data Models

### Document Schema
```python
{
  "id": "string",  # Auto-generated MongoDB ObjectId
  "name": "string",
  "description": "string | null",
  "tags": ["string"],
  "metadata": {},  # Flexible key-value pairs
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Item Schema (Inventory)
```python
{
  "id": "string",
  "name": "string",
  "description": "string | null",
  "price": float,
  "quantity": int,
  "category": "string",
  "in_stock": bool,
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## Architecture

### Files Structure
```
app/
  mongodb/
    __init__.py       # Module initialization
    models.py         # Pydantic schemas for validation
    routes.py         # FastAPI routes/endpoints
  db/
    mongodb.py        # MongoDB connection manager
```

### Connection Management

- Uses `motor` for async MongoDB operations
- Connection is initialized on application startup
- Gracefully handles MongoDB unavailability
- Connection is closed on application shutdown

### Key Features

1. **Async Operations**: All MongoDB operations are asynchronous for better performance
2. **Schema Validation**: Pydantic models ensure data integrity
3. **Error Handling**: Comprehensive error messages for debugging
4. **Pagination**: Built-in pagination support for listing endpoints
5. **Filtering**: Query parameters for filtering results
6. **Flexible Schema**: Documents support arbitrary metadata

## Best Practices

1. **Use MongoDB for**:
   - Unstructured/semi-structured data
   - Flexible schemas that change frequently
   - Nested documents and arrays
   - Rapid prototyping
   - Logging and analytics data

2. **Use SQLite/PostgreSQL for**:
   - User authentication and authorization
   - Transactional data
   - Data requiring ACID guarantees
   - Relational data with complex joins

3. **Performance Tips**:
   - Create indexes for frequently queried fields
   - Use pagination for large result sets
   - Limit the size of embedded documents
   - Use projections to fetch only needed fields

## Troubleshooting

### MongoDB Not Available
If MongoDB is not running, you'll see:
```
⚠️  MongoDB not available: [Errno 111] Connection refused
   MongoDB endpoints will not work until MongoDB is started
```

**Solution**: Start MongoDB:
```bash
sudo systemctl start mongodb
# or
docker start mongodb
```

### Connection Timeout
If requests timeout, check:
1. MongoDB is running: `sudo systemctl status mongodb`
2. MongoDB port is accessible: `netstat -tulpn | grep 27017`
3. Firewall settings allow port 27017

### Invalid ObjectId Error
MongoDB uses ObjectId for document IDs. Ensure IDs are valid 24-character hex strings.

Example valid ID: `507f1f77bcf86cd799439011`

## Next Steps

1. **Add More Collections**: Create additional collections by following the pattern in `app/mongodb/`
2. **Add Indexes**: Improve query performance with MongoDB indexes
3. **Add Authentication**: Secure MongoDB endpoints with JWT authentication
4. **Add Aggregations**: Implement MongoDB aggregation pipelines for complex queries
5. **Add Full-Text Search**: Enable MongoDB text search capabilities

## API Documentation

Full interactive API documentation is available at:
```
http://localhost:8000/docs
```

Look for endpoints tagged with **"MongoDB"**.
