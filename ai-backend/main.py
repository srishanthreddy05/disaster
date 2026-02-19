from __future__ import annotations

import json
import os
from typing import Any, Dict, List

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, db, initialize_app
import insightface

app = FastAPI(title="AI Face Service", version="1.0.0")

ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_model: insightface.app.FaceAnalysis | None = None


def init_firebase() -> None:
    if firebase_admin._apps:
        return

    database_url = os.getenv("FIREBASE_DB_URL")
    if not database_url:
        raise RuntimeError("FIREBASE_DB_URL is required for Firebase initialization")

    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

    if service_account_path:
        cred = credentials.Certificate(service_account_path)
    elif service_account_json:
        cred = credentials.Certificate(json.loads(service_account_json))
    else:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_JSON is required")

    initialize_app(cred, {"databaseURL": database_url})


def get_model() -> insightface.app.FaceAnalysis:
    global _model
    if _model is None:
        model = insightface.app.FaceAnalysis(
            name="buffalo_l",
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        model.prepare(ctx_id=0, det_size=(640, 640))
        _model = model
    return _model


def decode_image(contents: bytes) -> np.ndarray:
    image_array = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Unable to decode image")
    return image


def extract_embedding(image: np.ndarray) -> List[float]:
    model = get_model()
    faces = model.get(image)
    if not faces:
        raise HTTPException(status_code=400, detail="No face detected in image")

    largest_face = max(faces, key=lambda face: (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]))
    embedding = largest_face.embedding
    if embedding is None or len(embedding) != 512:
        raise HTTPException(status_code=500, detail="Failed to generate a 512-d embedding")
    return embedding.astype(float).tolist()


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


@app.on_event("startup")
def on_startup() -> None:
    init_firebase()
    get_model()


@app.post("/generate-embedding")
async def generate_embedding(file: UploadFile = File(...)) -> Dict[str, Any]:
    contents = await file.read()
    image = decode_image(contents)
    embedding = extract_embedding(image)
    return {"embedding": embedding}


@app.post("/match-face")
async def match_face(file: UploadFile = File(...), threshold: float = 0.55) -> Dict[str, Any]:
    contents = await file.read()
    image = decode_image(contents)
    embedding = extract_embedding(image)

    query_embedding = np.array(embedding, dtype=np.float32)

    ref = db.reference("embeddings")
    data = ref.get() or {}

    matches: List[Dict[str, Any]] = []
    for person_id, embedding_data in data.items():
        stored_list = embedding_data.get("embedding") if isinstance(embedding_data, dict) else None
        if not isinstance(stored_list, list) or len(stored_list) != 512:
            continue

        stored_embedding = np.array(stored_list, dtype=np.float32)
        similarity = cosine_similarity(query_embedding, stored_embedding)

        if similarity >= threshold:
            matches.append({
                "person_id": person_id,
                "similarity": similarity,
                "name": embedding_data.get("name", "Unknown") if isinstance(embedding_data, dict) else "Unknown",
            })

    matches.sort(key=lambda item: item["similarity"], reverse=True)
    return {"matches": matches}