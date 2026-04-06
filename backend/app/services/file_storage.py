"""MinIO/S3 file storage for verification and IP claim documents.

Provides async upload to MinIO with fallback to local storage.
"""

import logging
import uuid
from pathlib import Path
from typing import Optional, Tuple

from fastapi import UploadFile

from app.core.config import settings

logger = logging.getLogger(__name__)


async def _upload_to_minio(
    key: str,
    content: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload file content to MinIO and return the public URL.

    Creates a fresh client for each upload to avoid coroutine reuse issues.
    """
    import aiobotocore.session

    session = aiobotocore.session.get_session()
    protocol = "https" if settings.MINIO_USE_SSL else "http"
    endpoint = f"{protocol}://{settings.MINIO_ENDPOINT}"

    async with session.create_client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
    ) as s3:
        await s3.put_object(
            Bucket=settings.MINIO_BUCKET,
            Key=key,
            Body=content,
            ContentType=content_type,
        )

    # Return MinIO public URL
    return f"{endpoint}/{settings.MINIO_BUCKET}/{key}"


async def _upload_local_fallback(
    key: str,
    content: bytes,
    base_dir: str = "uploads",
) -> str:
    """Fallback: save to local filesystem."""
    upload_dir = Path(base_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    target = upload_dir / key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    
    # Normalize path for cross-platform compatibility
    return str(target).replace("\\", "/")


async def upload_file(
    file: UploadFile,
    prefix: str,
    filename: Optional[str] = None,
    base_dir: str = "uploads",
) -> str:
    """Upload a file to MinIO and return the URL.

    Args:
        file: FastAPI UploadFile.
        prefix: Path prefix (e.g., 'verification/uuid', 'ip_claims/uuid').
        filename: Optional custom filename. Generated if not provided.
        base_dir: Base directory for local fallback.

    Returns:
        Public URL of the uploaded file.
    """
    content = await file.read()
    safe_name = filename or f"{uuid.uuid4().hex}_{file.filename or 'document'}"
    key = f"{prefix}/{safe_name}"
    content_type = file.content_type or "application/octet-stream"

    try:
        url = await _upload_to_minio(key, content, content_type)
        logger.info("Uploaded %s to MinIO: %s", key, url)
        return url
    except Exception as exc:
        logger.warning("MinIO upload failed (%s), using local fallback: %s", exc, key)
        return await _upload_local_fallback(key, content, base_dir=base_dir)


async def save_verification_documents(
    user_id: uuid.UUID,
    id_document: UploadFile,
    selfie: UploadFile,
    video: Optional[UploadFile] = None,
    base_dir: str = "uploads",
) -> Tuple[str, str, Optional[str]]:
    """Upload ID document, selfie, and optional video to MinIO.

    Returns:
        Tuple of (id_document_url, selfie_url, video_url)
    """
    prefix = f"verification/{user_id}"

    id_url = await upload_file(
        id_document,
        prefix=prefix,
        filename=f"id_{id_document.filename or uuid.uuid4().hex}",
        base_dir=base_dir,
    )

    selfie_url = await upload_file(
        selfie,
        prefix=prefix,
        filename=f"selfie_{selfie.filename or uuid.uuid4().hex}",
        base_dir=base_dir,
    )

    video_url = None
    if video:
        video_url = await upload_file(
            video,
            prefix=prefix,
            filename=f"video_{video.filename or uuid.uuid4().hex}.mp4",
            base_dir=base_dir,
        )

    return id_url, selfie_url, video_url


async def save_ip_claim_document(
    claim_id: uuid.UUID,
    file: UploadFile,
    doc_type: str = "document",
    base_dir: str = "uploads",
) -> str:
    """Upload IP claim document to MinIO.

    Args:
        claim_id: UUID of the IP claim.
        file: FastAPI UploadFile.
        doc_type: Document type prefix for naming.
        base_dir: Base directory for local fallback.

    Returns:
        Public URL of the uploaded file.
    """
    prefix = f"ip_claims/{claim_id}/{doc_type}"
    return await upload_file(file, prefix=prefix, base_dir=base_dir)
