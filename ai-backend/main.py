from __future__ import annotations

import json
import os
from typing import Any, Dict, List
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, db, initialize_app
import insightface

# ==================== ENVIRONMENT SETUP ====================

# Load environment variables from .env file
env_path = Path(__file__).parent / ".env"
load_dotenv(str(env_path))

# ==================== CONFIGURATION ====================

app = FastAPI(title="AI Face Service", version="1.0.0")

ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance (loaded once on startup)
_model: insightface.app.FaceAnalysis | None = None
EMBEDDING_DIM = 512
SIMILARITY_THRESHOLD = 0.55

# ==================== FIREBASE INITIALIZATION ====================


def init_firebase() -> None:
    """Initialize Firebase Admin SDK for Realtime Database access."""
    if firebase_admin._apps:
        print("[Firebase] Already initialized, skipping re-initialization")
        return

    database_url = os.getenv("FIREBASE_DB_URL", "").strip()
    if not database_url:
        error_msg = "FIREBASE_DB_URL environment variable is missing. Please set it in .env file."
        print(f"[Firebase] [ERROR] {error_msg}")
        raise RuntimeError(error_msg)

    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT", "").strip()
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()

    cred = None

    if service_account_path:
        if not Path(service_account_path).exists():
            error_msg = f"Service account file not found: {service_account_path}"
            print(f"[Firebase] [ERROR] {error_msg}")
            raise RuntimeError(error_msg)
        try:
            cred = credentials.Certificate(service_account_path)
            print(f"[Firebase] [SUCCESS] Loaded service account from file: {service_account_path}")
        except Exception as e:
            error_msg = f"Failed to load service account from file: {e}"
            print(f"[Firebase] [ERROR] {error_msg}")
            raise RuntimeError(error_msg) from e

    elif service_account_json:
        try:
            cred = credentials.Certificate(json.loads(service_account_json))
            print("[Firebase] [SUCCESS] Loaded service account from JSON environment variable")
        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON in FIREBASE_SERVICE_ACCOUNT_JSON: {e}"
            print(f"[Firebase] [ERROR] {error_msg}")
            raise RuntimeError(error_msg) from e
        except Exception as e:
            error_msg = f"Failed to load service account from JSON: {e}"
            print(f"[Firebase] [ERROR] {error_msg}")
            raise RuntimeError(error_msg) from e

    if cred is None:
        error_msg = "Neither FIREBASE_SERVICE_ACCOUNT nor FIREBASE_SERVICE_ACCOUNT_JSON is set. Please configure one in .env"
        print(f"[Firebase] [ERROR] {error_msg}")
        raise RuntimeError(error_msg)

    try:
        initialize_app(cred, {"databaseURL": database_url})
        print(f"[Firebase] [SUCCESS] Initialized with database URL: {database_url}")
    except Exception as e:
        error_msg = f"Failed to initialize Firebase: {e}"
        print(f"[Firebase] [ERROR] {error_msg}")
        raise RuntimeError(error_msg) from e


# ==================== MODEL LOADING ====================


def get_model() -> insightface.app.FaceAnalysis:
    """
    Get or initialize the InsightFace model (singleton pattern).
    
    Uses buffalo_l model with CPU mode (ctx_id=-1) for broad compatibility.
    Model is loaded only once on first call and cached globally.
    
    Returns:
        insightface.app.FaceAnalysis: Initialized face analysis model
        
    Raises:
        RuntimeError: If model initialization fails
    """
    global _model
    
    if _model is not None:
        return _model
    
    try:
        print("[Model] Initializing InsightFace buffalo_l model (this may take a moment)...")
        
        # Create model instance with buffalo_l (512-d embeddings)
        model = insightface.app.FaceAnalysis(name="buffalo_l")
        
        # Prepare model for CPU mode (ctx_id=-1)
        # det_size=(640, 640) for balanced detection/speed tradeoff
        model.prepare(ctx_id=-1, det_size=(640, 640))
        
        _model = model
        print("[Model] [SUCCESS] InsightFace buffalo_l loaded (CPU mode)")
        print(f"[Model] [SUCCESS] Embedding dimension: {EMBEDDING_DIM}D")
        print(f"[Model] [SUCCESS] Similarity threshold: {SIMILARITY_THRESHOLD}")
        return _model
        
    except ImportError as e:
        error_msg = f"Failed to import required dependency: {e}"
        error_msg += "\nMake sure onnxruntime is installed: pip install onnxruntime"
        print(f"[Model] [ERROR] {error_msg}")
        raise RuntimeError(error_msg) from e
        
    except Exception as e:
        error_msg = f"Failed to initialize InsightFace model: {e}"
        print(f"[Model] [ERROR] {error_msg}")
        raise RuntimeError(error_msg) from e


# ==================== IMAGE PROCESSING ====================


def decode_image(contents: bytes) -> np.ndarray:
    """
    Decode image bytes to numpy array.
    
    Args:
        contents: Raw image bytes
        
    Returns:
        np.ndarray: Image as numpy array (BGR format)
        
    Raises:
        HTTPException: If image cannot be decoded
    """
    try:
        image_array = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(
                status_code=400,
                detail="Unable to decode image. Ensure it is a valid image file (JPEG, PNG, etc.)"
            )
        
        return image
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Image decode error: {str(e)}"
        ) from e


# ==================== EMBEDDING EXTRACTION ====================


def extract_embedding(image: np.ndarray) -> List[float]:
    """
    Extract face embedding from image using buffalo_l model.
    
    Takes the largest face in the image and extracts a 512-dimensional embedding.
    
    Args:
        image: Image as numpy array (BGR format)
        
    Returns:
        List[float]: 512-dimensional embedding vector
        
    Raises:
        HTTPException: If no face detected or embedding extraction fails
    """
    try:
        model = get_model()
        faces = model.get(image)
        
        if not faces or len(faces) == 0:
            raise HTTPException(
                status_code=400,
                detail="No face detected in image. Please provide an image with a clear face."
            )
        
        # Use largest face by bounding box area
        largest_face = max(
            faces,
            key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
        )
        
        embedding = largest_face.embedding
        
        if embedding is None:
            raise HTTPException(
                status_code=500,
                detail="Failed to extract embedding from detected face"
            )
        
        if len(embedding) != EMBEDDING_DIM:
            raise HTTPException(
                status_code=500,
                detail=f"Invalid embedding dimension: {len(embedding)}, expected {EMBEDDING_DIM}"
            )
        
        return embedding.astype(float).tolist()
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Embedding extraction error: {str(e)}"
        ) from e


# ==================== SIMILARITY MATCHING ====================


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """
    Compute cosine similarity between two vectors.
    
    Formula: cos(theta) = (a · b) / (||a|| * ||b||)
    
    Args:
        a: First vector
        b: Second vector
        
    Returns:
        float: Cosine similarity in range [-1, 1], typically [0, 1] for embeddings
    """
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
    
    return float(np.dot(a, b) / (norm_a * norm_b))


# ==================== API ENDPOINTS ====================


@app.on_event("startup")
def on_startup() -> None:
    """Initialize Firebase and load model on application startup."""
    print("\n")
    print("=" * 70)
    print("AI Face Service Startup")
    print("=" * 70)
    
    try:
        print("[Startup] Loading environment variables...")
        init_firebase()
        print("[Startup] Firebase initialized successfully")
        
        print("[Startup] Loading InsightFace model...")
        get_model()
        
        print("=" * 70)
        print("[Startup] [SUCCESS] All systems ready. Service is online.")
        print("=" * 70)
        print()
        
    except Exception as e:
        print("=" * 70)
        print(f"[Startup] [FAILED] Startup failed: {e}")
        print("=" * 70)
        print()
        raise


@app.get("/health")
def health_check() -> Dict[str, Any]:
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "service": "AI Face Service",
        "model": "InsightFace buffalo_l",
        "embedding_dimension": EMBEDDING_DIM
    }


@app.post("/generate-embedding")
async def generate_embedding(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Generate 512-dimensional face embedding from uploaded image.
    
    The embedding is extracted from the largest face in the image using
    the InsightFace buffalo_l model.
    
    Args:
        file: Image file upload (JPEG, PNG, etc.)
        
    Returns:
        JSON with embedding array and metadata
        
    Example response:
        {
            "embedding": [0.123, -0.456, ..., 0.789],
            "dimension": 512,
            "status": "success"
        }
        
    Raises:
        HTTPException: 400 if no face detected, 500 on processing error
    """
    try:
        # Read and decode image
        contents = await file.read()
        if not contents:
            raise HTTPException(
                status_code=400,
                detail="Empty file uploaded"
            )
        
        image = decode_image(contents)
        
        # Extract embedding
        embedding = extract_embedding(image)
        
        return {
            "embedding": embedding,
            "dimension": len(embedding),
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Embedding generation failed: {str(e)}"
        ) from e


@app.post("/match-face")
async def match_face(
    file: UploadFile = File(...),
    threshold: float = SIMILARITY_THRESHOLD
) -> Dict[str, Any]:
    """
    Match uploaded face against database of stored embeddings.
    
    Generates embedding from uploaded image, queries Firebase embeddings
    database, and returns matches above the similarity threshold (default 0.55).
    
    Similarity score interpretation:
    - 0.55-0.65: Possible match (needs verification)
    - 0.65-0.75: Strong match (likely same person)
    - 0.75+: Very strong match (almost certainly same person)
    
    Args:
        file: Image file upload containing a face
        threshold: Similarity threshold for matches (default 0.55, range 0.0-1.0)
        
    Returns:
        JSON with sorted matches and metadata
        
    Example response:
        {
            "status": "success",
            "matches_found": 2,
            "threshold": 0.55,
            "matches": [
                {
                    "person_id": "person_123",
                    "name": "John Doe",
                    "similarity": 0.87,
                    "age": 28,
                    "description": "Missing since..."
                }
            ]
        }
        
    Raises:
        HTTPException: 400 if threshold invalid or no face detected, 500 on error
    """
    try:
        # Validate threshold
        if not isinstance(threshold, (int, float)) or not (0.0 <= threshold <= 1.0):
            raise HTTPException(
                status_code=400,
                detail="Threshold must be a number between 0.0 and 1.0"
            )
        
        # Read and decode image
        contents = await file.read()
        if not contents:
            raise HTTPException(
                status_code=400,
                detail="Empty file uploaded"
            )
        
        image = decode_image(contents)
        
        # Extract embedding from query image
        query_embedding_list = extract_embedding(image)
        query_embedding = np.array(query_embedding_list, dtype=np.float32)
        
        # Query Firebase embeddings database
        try:
            ref = db.reference("embeddings")
            data = ref.get() or {}
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to query embeddings database: {str(e)}"
            ) from e
        
        matches: List[Dict[str, Any]] = []
        
        for person_id, embedding_data in data.items():
            # Handle both direct embedding list and nested structure
            if isinstance(embedding_data, dict):
                stored_list = embedding_data.get("embedding")
            else:
                stored_list = embedding_data
            
            # Validate stored embedding
            if not isinstance(stored_list, list) or len(stored_list) != EMBEDDING_DIM:
                continue
            
            # Compute similarity
            try:
                stored_embedding = np.array(stored_list, dtype=np.float32)
                similarity = cosine_similarity(query_embedding, stored_embedding)
            except Exception:
                continue  # Skip invalid embeddings
            
            # Add match if above threshold
            if similarity >= threshold:
                match_entry: Dict[str, Any] = {
                    "person_id": person_id,
                    "similarity": round(float(similarity), 4),
                }
                
                # Add optional fields from database
                if isinstance(embedding_data, dict):
                    if "name" in embedding_data:
                        match_entry["name"] = embedding_data["name"]
                    if "age" in embedding_data:
                        match_entry["age"] = embedding_data["age"]
                    if "description" in embedding_data:
                        match_entry["description"] = embedding_data["description"]
                
                matches.append(match_entry)
        
        # Sort by similarity descending
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        
        return {
            "status": "success",
            "matches_found": len(matches),
            "threshold": threshold,
            "matches": matches
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Face matching failed: {str(e)}"
        ) from e


# ==================== ROOT ENDPOINT ====================


@app.get("/")
def root() -> Dict[str, Any]:
    """Root endpoint with service information."""
    return {
        "service": "AI Face Service",
        "version": "1.0.0",
        "status": "operational",
        "model": "InsightFace buffalo_l",
        "embedding_dimension": EMBEDDING_DIM,
        "similarity_threshold": SIMILARITY_THRESHOLD,
        "endpoints": {
            "health": "GET /health - Health check",
            "generate": "POST /generate-embedding - Generate face embedding",
            "match": "POST /match-face - Match face against database"
        }
    }
