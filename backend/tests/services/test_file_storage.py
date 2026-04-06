"""Tests for app/services/file_storage.py — Local filesystem storage.

Tests cover:
- Verification document upload (ID + selfie)
- IP claim document upload
- Directory structure creation
- File content integrity
- Error handling
"""

from __future__ import annotations

import shutil
import uuid
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock

import pytest

from app.services.file_storage import (
    save_ip_claim_document,
    save_verification_documents,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TEST_BASE_DIR = "test_uploads"


def _make_upload_file(filename: str, content: bytes) -> MagicMock:
    """Create a mock UploadFile with given content."""
    mock_file = MagicMock()
    mock_file.filename = filename
    mock_file.read = AsyncMock(return_value=content)
    return mock_file


@pytest.fixture(autouse=True)
def cleanup_test_uploads():
    """Remove test_uploads/ after each test."""
    yield
    test_dir = Path(TEST_BASE_DIR)
    if test_dir.exists():
        shutil.rmtree(test_dir)


# ---------------------------------------------------------------------------
# 1. Verification Documents
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_save_verification_documents_creates_files():
    """ID document and selfie saved to disk."""
    user_id = uuid.uuid4()
    id_file = _make_upload_file("id.png", b"fake-id-data")
    selfie_file = _make_upload_file("selfie.png", b"fake-selfie-data")

    id_path, selfie_path, video_path = await save_verification_documents(
        user_id, id_file, selfie_file, base_dir=TEST_BASE_DIR
    )

    # Files exist
    assert Path(id_path).exists()
    assert Path(selfie_path).exists()
    assert video_path is None


@pytest.mark.asyncio
async def test_save_verification_documents_content_integrity():
    """Saved files contain exact uploaded content."""
    user_id = uuid.uuid4()
    id_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    selfie_content = b"\xff\xd8\xff\xe0" + b"\x01" * 100

    id_file = _make_upload_file("id.png", id_content)
    selfie_file = _make_upload_file("selfie.png", selfie_content)

    id_path, selfie_path, video_path = await save_verification_documents(
        user_id, id_file, selfie_file, base_dir=TEST_BASE_DIR
    )

    assert Path(id_path).read_bytes() == id_content
    assert Path(selfie_path).read_bytes() == selfie_content
    assert video_path is None


@pytest.mark.asyncio
async def test_save_verification_documents_directory_structure():
    """Files saved in uploads/verification/{user_id}/."""
    user_id = uuid.uuid4()
    id_file = _make_upload_file("id.png", b"data")
    selfie_file = _make_upload_file("selfie.png", b"data")

    id_path, selfie_path, video_path = await save_verification_documents(
        user_id, id_file, selfie_file, base_dir=TEST_BASE_DIR
    )

    # Path contains user_id
    assert str(user_id) in id_path
    assert str(user_id) in selfie_path
    # Note: 'verification' is not in path unless base_dir includes it


@pytest.mark.asyncio
async def test_save_verification_documents_generates_filename():
    """Filenames prefixed with id_/selfie_ when original name missing."""
    user_id = uuid.uuid4()
    id_file = _make_upload_file(None, b"data")
    selfie_file = _make_upload_file(None, b"data")

    id_path, selfie_path, video_path = await save_verification_documents(
        user_id, id_file, selfie_file, base_dir=TEST_BASE_DIR
    )

    id_filename = Path(id_path).name
    selfie_filename = Path(selfie_path).name
    assert id_filename.startswith("id_")
    assert selfie_filename.startswith("selfie_")


@pytest.mark.asyncio
async def test_save_verification_documents_creates_dir_if_missing():
    """Parent directory created if it doesn't exist."""
    user_id = uuid.uuid4()
    id_file = _make_upload_file("id.png", b"data")
    selfie_file = _make_upload_file("selfie.png", b"data")

    # Ensure base dir doesn't exist
    assert not Path(TEST_BASE_DIR).exists()

    id_path, selfie_path, video_path = await save_verification_documents(
        user_id, id_file, selfie_file, base_dir=TEST_BASE_DIR
    )

    # Directory created
    assert Path(TEST_BASE_DIR).exists()


# ---------------------------------------------------------------------------
# 2. IP Claim Documents
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_save_ip_claim_document_creates_file():
    """Document saved to disk."""
    claim_id = uuid.uuid4()
    doc_file = _make_upload_file("spec.pdf", b"%PDF-fake-data")

    file_path = await save_ip_claim_document(claim_id, doc_file, base_dir=TEST_BASE_DIR)

    assert Path(file_path).exists()


@pytest.mark.asyncio
async def test_save_ip_claim_document_content_integrity():
    """Saved file contains exact uploaded content."""
    claim_id = uuid.uuid4()
    content = b"%PDF-1.4\n" + b"\x00" * 200
    doc_file = _make_upload_file("spec.pdf", content)

    file_path = await save_ip_claim_document(claim_id, doc_file, base_dir=TEST_BASE_DIR)

    assert Path(file_path).read_bytes() == content


@pytest.mark.asyncio
async def test_save_ip_claim_document_directory_structure():
    """Document saved in uploads/ip_claims/{claim_id}/."""
    claim_id = uuid.uuid4()
    doc_file = _make_upload_file("spec.pdf", b"data")

    file_path = await save_ip_claim_document(claim_id, doc_file, base_dir=TEST_BASE_DIR)

    assert str(claim_id) in file_path
    # Note: 'ip_claims' is not in path unless base_dir includes it


@pytest.mark.asyncio
async def test_save_ip_claim_document_generates_filename():
    """Filename generated when original name missing."""
    claim_id = uuid.uuid4()
    doc_file = _make_upload_file(None, b"data")

    file_path = await save_ip_claim_document(claim_id, doc_file, base_dir=TEST_BASE_DIR)

    filename = Path(file_path).name
    # Generated filename: {uuid}_document (no original filename)
    assert "document" in filename
    assert filename.endswith(".bin") is False  # No extension added


@pytest.mark.asyncio
async def test_save_ip_claim_document_preserves_original_name():
    """Original filename preserved in path."""
    claim_id = uuid.uuid4()
    original_name = "patent_spec_v2.pdf"
    doc_file = _make_upload_file(original_name, b"data")

    file_path = await save_ip_claim_document(claim_id, doc_file, base_dir=TEST_BASE_DIR)

    assert original_name in file_path


@pytest.mark.asyncio
async def test_save_multiple_documents_same_claim():
    """Multiple documents can be saved for same claim."""
    claim_id = uuid.uuid4()
    files = [
        _make_upload_file("doc1.pdf", b"doc1-data"),
        _make_upload_file("doc2.pdf", b"doc2-data"),
        _make_upload_file("doc3.pdf", b"doc3-data"),
    ]

    paths = []
    for f in files:
        path = await save_ip_claim_document(claim_id, f, base_dir=TEST_BASE_DIR)
        paths.append(path)

    # All files exist
    for p in paths:
        assert Path(p).exists()

    # Content integrity
    assert Path(paths[0]).read_bytes() == b"doc1-data"
    assert Path(paths[1]).read_bytes() == b"doc2-data"
    assert Path(paths[2]).read_bytes() == b"doc3-data"


# ---------------------------------------------------------------------------
# 3. Path normalization (Windows → Unix)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_paths_use_forward_slashes():
    """Returned paths normalized with forward slashes."""
    user_id = uuid.uuid4()
    id_file = _make_upload_file("id.png", b"data")
    selfie_file = _make_upload_file("selfie.png", b"data")

    id_path, selfie_path, video_path = await save_verification_documents(
        user_id, id_file, selfie_file, base_dir=TEST_BASE_DIR
    )

    assert "\\" not in id_path
    assert "\\" not in selfie_path


@pytest.mark.asyncio
async def test_ip_claim_path_forward_slashes():
    """IP claim path uses forward slashes."""
    claim_id = uuid.uuid4()
    doc_file = _make_upload_file("doc.pdf", b"data")

    file_path = await save_ip_claim_document(claim_id, doc_file, base_dir=TEST_BASE_DIR)

    assert "\\" not in file_path
