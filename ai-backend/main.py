from __future__ import annotations

import json
import os
from typing import Any, Dict, List
from pathlib import Path

import cv2
import numpy as np
from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
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
    """
    Initialize Firebase Admin SDK for Realtime Database access.

    Supports two credential modes with clear precedence:
    1. FIREBASE_SERVICE_ACCOUNT_JSON: Production mode (Render, cloud platforms)
       - Must be a valid JSON string (parsed with json.loads)
       - Prioritized over file path if both are present

    2. FIREBASE_SERVICE_ACCOUNT: Local development mode
       - Must be a file path to service account JSON
       - Used if JSON environment variable is not set

    FIREBASE_DB_URL is always required and validates the database connection.

    Raises:
        RuntimeError: If configuration is incomplete or invalid
    """
    # Prevent duplicate initialization
    if firebase_admin._apps:
        print("[Firebase] Already initialized, skipping re-initialization")
        return

    # Step 1: Validate database URL (required in all modes)
    database_url = os.getenv("FIREBASE_DB_URL", "").strip()
    if not database_url:
        error_msg = "FIREBASE_DB_URL is not configured. Set it in .env file or environment variables."
        print(f"[Firebase] [ERROR] {error_msg}")
        raise RuntimeError(error_msg)

    print(f"[Firebase] Using database URL: {database_url}")

    # Step 2: Get credential configuration values
    service_account_json_str = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    service_account_file_path = os.getenv("FIREBASE_SERVICE_ACCOUNT", "").strip()

    cred = None

    # Step 3a: Priority 1 - Load from JSON string (production mode)
    if service_account_json_str:
        print("[Firebase] Attempting to load credentials from FIREBASE_SERVICE_ACCOUNT_JSON...")

        try:
            # Parse JSON string to dict
            service_account_dict = json.loads(service_account_json_str)
            print("[Firebase] [OK] JSON string parsed successfully")
        except json.JSONDecodeError as e:
            error_msg = f"FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: {e}"
            print(f"[Firebase] [ERROR] {error_msg}")
            raise RuntimeError(error_msg) from e

        try:
            # Convert to Firebase credentials
            cred = credentials.Certificate(service_account_dict)
            print("[Firebase] [OK] Credentials loaded from JSON environment variable")
        except Exception as e:
            error_msg = f"Firebase Certificate() failed to process JSON credentials: {e}"
            print(f"[Firebase] [ERROR] {error_msg}")
            raise RuntimeError(error_msg) from e

    # Step 3b: Priority 2 - Load from file path (local development mode)
    elif service_account_file_path:
        print("[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON not set, checking file path...")
        print(f"[Firebase] Looking for credentials file: {service_account_file_path}")

        if not Path(service_account_file_path).exists():
            error_msg = f"Service account file not found at: {service_account_file_path}"
            print(f"[Firebase] [ERROR] {error_msg}")
            raise RuntimeError(error_msg)

        try:
            cred = credentials.Certificate(service_account_file_path)
            print(f"[Firebase] [OK] Credentials loaded from file: {service_account_file_path}")
        except Exception as e:
            error_msg = f"Firebase Certificate() failed to load file credentials: {e}"
            print(f"[Firebase] [ERROR] {error_msg}")
            raise RuntimeError(error_msg) from e

    # Step 3c: No credentials found
    if cred is None:
        error_msg = (
            "No Firebase credentials found. Configure one of:\n"
            "  - FIREBASE_SERVICE_ACCOUNT_JSON (JSON string, for production)\n"
            "  - FIREBASE_SERVICE_ACCOUNT (file path, for local development)\n"
            "Please set one in .env or environment variables."
        )
        print(f"[Firebase] [ERROR] {error_msg}")
        raise RuntimeError(error_msg)

    # Step 4: Initialize Firebase app with credentials and database URL
    try:
        print("[Firebase] Initializing Firebase app...")
        initialize_app(cred, {"databaseURL": database_url})
        print("[Firebase] [OK] Firebase app initialized successfully")
    except Exception as e:
        error_msg = f"Firebase initialization failed: {e}"
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
    Compute cosine similarity between two pre-normalized vectors.
    
    For normalized vectors, cosine similarity equals dot product.
    
    Args:
        a: First vector
        b: Second vector
        
    Returns:
        float: Cosine similarity in range [-1, 1], typically [0, 1] for embeddings
    """
    return float(np.dot(a, b))


def safe_numpy_embedding(raw_embedding: Any, label: str) -> np.ndarray:
    """
    Convert incoming embedding data to a validated float32 numpy vector.

    Args:
        raw_embedding: Raw embedding data (typically a list)
        label: Context label used in error/debug messages

    Returns:
        np.ndarray: 1D float32 vector of length EMBEDDING_DIM

    Raises:
        ValueError: If conversion/shape/content is invalid
    """
    if not isinstance(raw_embedding, list):
        raise ValueError(f"{label} must be a list of {EMBEDDING_DIM} numeric values")

    try:
        vector = np.asarray(raw_embedding, dtype=np.float32)
    except (TypeError, ValueError) as e:
        raise ValueError(f"{label} contains non-numeric values") from e

    if vector.ndim != 1 or vector.shape[0] != EMBEDDING_DIM:
        raise ValueError(f"{label} must have exactly {EMBEDDING_DIM} values")

    if not np.all(np.isfinite(vector)):
        raise ValueError(f"{label} contains NaN or infinite values")

    return vector


def normalize_embedding(vector: np.ndarray, label: str) -> np.ndarray:
    """
    Normalize embedding to unit length exactly once.

    Args:
        vector: Input embedding vector
        label: Context label used in error/debug messages

    Returns:
        np.ndarray: L2-normalized vector

    Raises:
        ValueError: If vector norm is zero
    """
    norm = np.linalg.norm(vector)
    if norm == 0:
        raise ValueError(f"{label} has zero norm and cannot be normalized")
    return vector / norm


class MatchFaceRequest(BaseModel):
    embedding: List[float]


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
        
        # Extract embedding from largest detected face
        raw_embedding = extract_embedding(image)

        # Safe conversion and strict validation (float32, 512D)
        embedding_vector = safe_numpy_embedding(raw_embedding, "Generated embedding")

        # Normalize exactly once
        embedding_vector = normalize_embedding(embedding_vector, "Generated embedding")

        # Return clean float list (not string), fixed to EMBEDDING_DIM
        embedding = embedding_vector.astype(np.float32).tolist()
        
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
    payload: MatchFaceRequest | None = Body(default=None),
    file: UploadFile | None = File(default=None),
    threshold: float = SIMILARITY_THRESHOLD
) -> Dict[str, Any]:
    """
    Match face embedding against database of stored embeddings.

    Accepts either:
    1) JSON body: {"embedding": [...]}  (preferred)
    2) Multipart file upload with `file` (backward compatible)

    Queries Firebase `missing_persons` and returns matches above threshold.
    
    Similarity score interpretation:
    - 0.55-0.65: Possible match (needs verification)
    - 0.65-0.75: Strong match (likely same person)
    - 0.75+: Very strong match (almost certainly same person)
    
    Args:
        payload: JSON payload with 512-d embedding
        file: Optional image file upload containing a face
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
        
        # Build query embedding from JSON payload (preferred) or fallback image file
        if payload is not None and payload.embedding is not None:
            query_embedding_raw = payload.embedding
        elif file is not None:
            contents = await file.read()
            if not contents:
                raise HTTPException(
                    status_code=400,
                    detail="Empty file uploaded"
                )

            image = decode_image(contents)
            query_embedding_raw = extract_embedding(image)
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide either JSON embedding or image file"
            )

        try:
            query_embedding = safe_numpy_embedding(query_embedding_raw, "Query embedding")
            query_embedding = normalize_embedding(query_embedding, "Query embedding")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        print(f"[Match] Query embedding length: {len(query_embedding)}")

        # Query Firebase missing person records
        try:
            ref = db.reference("missing_persons")
            data = ref.get() or {}
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to query embeddings database: {str(e)}"
            ) from e
        
        matches: List[Dict[str, Any]] = []
        
        for person_id, person_data in data.items():
            if not isinstance(person_data, dict):
                print(f"[Match] Skipping {person_id}: invalid record format")
                continue

            stored_raw = person_data.get("embedding")
            stored_length = len(stored_raw) if isinstance(stored_raw, list) else -1
            print(f"[Match] Record {person_id} stored embedding length: {stored_length}")

            try:
                stored_embedding = safe_numpy_embedding(stored_raw, f"Stored embedding ({person_id})")
                stored_embedding = normalize_embedding(stored_embedding, f"Stored embedding ({person_id})")
                similarity = cosine_similarity(query_embedding, stored_embedding)
                print(f"[Match] Record {person_id} similarity: {similarity:.6f}")
            except Exception as e:
                print(f"[Match] Skipping {person_id}: {e}")
                continue
            
            # Add match if above threshold
            if similarity >= threshold:
                match_entry: Dict[str, Any] = {
                    "person_id": person_id,
                    "similarity": round(float(similarity), 4),
                    "name": person_data.get("name"),
                    "age": person_data.get("age"),
                    "description": person_data.get("description"),
                    "imageUrl": person_data.get("imageUrl"),
                }

                matches.append(match_entry)
        
        # Sort by similarity descending
        matches.sort(key=lambda x: x["similarity"], reverse=True)

        # Return top 5 matches only
        top_matches = matches[:5]
        
        return {
            "status": "success",
            "matches_found": len(top_matches),
            "threshold": threshold,
            "matches": top_matches
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
