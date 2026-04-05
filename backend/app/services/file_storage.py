"""File storage utilities for verification and IP claim documents.

Provides local filesystem storage with configurable backend (S3/MinIO planned).
"""

import os
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import UploadFile


async def save_verification_documents(
    user_id: uuid.UUID,
    id_document: UploadFile,
    selfie: UploadFile,
    base_dir: str = "uploads/verification",
) -> Tuple[str, str]:
    """Save ID document and selfie to disk.

    Returns:
        Tuple of (id_document_path, selfie_path)
    """
    upload_dir = Path(base_dir) / str(user_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    id_filename = f"id_{id_document.filename or uuid.uuid4().hex}"
    selfie_filename = f"selfie_{selfie.filename or uuid.uuid4().hex}"

    id_path = upload_dir / id_filename
    selfie_path = upload_dir / selfie_filename

    id_content = await id_document.read()
    id_path.write_bytes(id_content)

    selfie_content = await selfie.read()
    selfie_path.write_bytes(selfie_content)

    return str(id_path).replace("\\", "/"), str(selfie_path).replace("\\", "/")


async def save_ip_claim_document(
    claim_id: uuid.UUID,
    file: UploadFile,
    base_dir: str = "uploads/ip_claims",
) -> str:
    """Save IP claim document to disk.

    Returns:
        File path (forward-slash normalized)
    """
    upload_dir = Path(base_dir) / str(claim_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = file.filename or f"document-{uuid.uuid4().hex}.bin"
    target = upload_dir / safe_name

    content = await file.read()
    target.write_bytes(content)

    return str(target).replace("\\", "/")
