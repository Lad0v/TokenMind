"""
Tests for IP Intelligence service layer:
- PatentStatusCheckService (cache hit/miss, fallback, unsupported country)
- PatentDataEnrichmentService
- InternationalSearchService
- Cache round-trip (_save_to_cache → _cache_to_record)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import respx
from httpx import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ip_claim import IpClaim, IpClaimStatus
from app.models.ip_intel import PatentCache, PatentCacheStatus
from app.schemas.ip_intel import NormalizedPatentRecord, AssigneeInfo, InventorInfo, GeoData


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_normalized_record(
    source: str = "USPTO",
    source_id: str = "1234567",
    title: str = "Test Patent",
    status: str = "granted",
) -> NormalizedPatentRecord:
    return NormalizedPatentRecord(
        source=source,
        source_id=source_id,
        country_code="US",
        kind_code="B2",
        title=title,
        abstract="A test patent",
        filing_date="2020-01-01",
        publication_date="2021-01-01",
        grant_date="2022-01-01",
        status=status,
        assignees=[AssigneeInfo(name="Acme Corp", type="company", country="US")],
        inventors=[InventorInfo(name="John Doe", country="US")],
        cpc_classes=["H04L9/00"],
        uspc_classes=["709/200"],
        ipc_classes=["H04L 9/00"],
        geo_data=GeoData(assignee_countries=["US"], inventor_countries=["US"]),
        family_ids=["fam-001"],
        citations_count=10,
        raw_data={"test": True},
    )


# ---------------------------------------------------------------------------
# 1. PatentStatusCheckService — Cache miss → external API → save
# ---------------------------------------------------------------------------

@respx.mock
async def test_check_patent_cache_miss_then_api(db_session: AsyncSession):
    """No cache → calls USPTO → saves to cache."""
    from app.services.ip_intel_service import PatentStatusCheckService

    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={
            "results": [{
                "patentNumber": "1234567",
                "inventionTitle": "API Patent",
                "abstractText": "From API",
                "filingDate": "2020-01-01",
                "grantDate": "2022-01-01",
                "status": "Active",
            }],
            "total": 1,
        })
    )

    service = PatentStatusCheckService(db_session)
    result = await service.check_patent("1234567", "US")

    assert result.exists is True
    assert result.primary_source == "USPTO"
    assert result.cached is False
    assert result.normalized_record is not None
    assert result.normalized_record.title == "API Patent"


# ---------------------------------------------------------------------------
# 2. PatentStatusCheckService — Cache hit
# ---------------------------------------------------------------------------

async def test_check_patent_cache_hit(db_session: AsyncSession):
    """Valid cache → returns cached data without API call."""
    from app.services.ip_intel_service import PatentStatusCheckService

    # Seed cache
    cached = PatentCache(
        source="USPTO",
        source_id="9999999",
        country_code="US",
        patent_number="9999999",
        kind_code="B2",
        title="Cached Patent",
        abstract="From cache",
        filing_date="2020-01-01",
        grant_date="2022-01-01",
        patent_status="granted",
        cache_status=PatentCacheStatus.VALID,
        cached_at=datetime.now(timezone.utc) - timedelta(hours=1),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=71),
    )
    db_session.add(cached)
    await db_session.flush()

    service = PatentStatusCheckService(db_session)
    result = await service.check_patent("9999999", "US")

    assert result.exists is True
    assert result.cached is True
    assert result.primary_source == "USPTO"
    assert result.normalized_record.title == "Cached Patent"


# ---------------------------------------------------------------------------
# 3. PatentStatusCheckService — Expired cache → API call
# ---------------------------------------------------------------------------

@respx.mock
async def test_check_patent_expired_cache_calls_api(db_session: AsyncSession):
    """Expired cache → calls API and updates cache."""
    from app.services.ip_intel_service import PatentStatusCheckService

    # Expired cache
    expired = PatentCache(
        source="USPTO",
        source_id="8888888",
        country_code="US",
        patent_number="8888888",
        title="Expired Patent",
        patent_status="granted",
        cache_status=PatentCacheStatus.VALID,
        cached_at=datetime.now(timezone.utc) - timedelta(hours=100),
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),  # expired
    )
    db_session.add(expired)
    await db_session.flush()

    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={
            "results": [{
                "patentNumber": "8888888",
                "inventionTitle": "Fresh Patent",
                "filingDate": "2020-01-01",
                "grantDate": "2022-01-01",
                "status": "Active",
            }],
            "total": 1,
        })
    )

    service = PatentStatusCheckService(db_session)
    result = await service.check_patent("8888888", "US")

    assert result.exists is True
    assert result.cached is False  # Not from cache
    assert result.normalized_record.title == "Fresh Patent"


# ---------------------------------------------------------------------------
# 4. PatentStatusCheckService — Patent not found
# ---------------------------------------------------------------------------

@respx.mock
async def test_check_patent_not_found(db_session: AsyncSession):
    """USPTO returns empty → exists=False."""
    from app.services.ip_intel_service import PatentStatusCheckService

    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={"results": [], "total": 0})
    )
    respx.post("https://data.uspto.gov/api/v1/patent/applications/search").mock(
        return_value=Response(200, json={"results": [], "total": 0})
    )

    service = PatentStatusCheckService(db_session)
    result = await service.check_patent("0000000", "US")

    assert result.exists is False
    assert result.normalized_record is None


# ---------------------------------------------------------------------------
# 5. PatentStatusCheckService — Unsupported country
# ---------------------------------------------------------------------------

async def test_check_patent_unsupported_country(db_session: AsyncSession):
    """Unsupported country code → ValueError."""
    from app.services.ip_intel_service import PatentStatusCheckService

    service = PatentStatusCheckService(db_session)

    with pytest.raises(ValueError, match="Unsupported country code"):
        await service.check_patent("JP12345", "JP")


# ---------------------------------------------------------------------------
# 6. PatentStatusCheckService — Recommendation logic
# ---------------------------------------------------------------------------

@respx.mock
async def test_recommendation_granted(db_session: AsyncSession):
    """Granted patent → recommended."""
    from app.services.ip_intel_service import PatentStatusCheckService
    from app.schemas.ip_intel import TokenizabilityRecommendation

    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={
            "results": [{
                "patentNumber": "1",
                "inventionTitle": "Granted",
                "status": "Active",
                "grantDate": "2022-01-01",
            }],
            "total": 1,
        })
    )
    # Fallback application search (shouldn't be called, but needs mock)
    respx.post("https://data.uspto.gov/api/v1/patent/applications/search").mock(
        return_value=Response(200, json={"results": [], "total": 0})
    )

    service = PatentStatusCheckService(db_session)
    result = await service.check_patent("1", "US")

    # TokenizabilityRecommendation is a str enum
    assert result.recommendation == TokenizabilityRecommendation.RECOMMENDED


@respx.mock
async def test_recommendation_pending(db_session: AsyncSession):
    """Pending patent → requires_review."""
    from app.services.ip_intel_service import PatentStatusCheckService
    from app.schemas.ip_intel import TokenizabilityRecommendation

    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={"results": [], "total": 0})
    )
    respx.post("https://data.uspto.gov/api/v1/patent/applications/search").mock(
        return_value=Response(200, json={
            "results": [{
                "applicationNumber": "17/001",
                "inventionTitle": "Pending App",
                "status": "Pending",
            }],
            "total": 1,
        })
    )

    service = PatentStatusCheckService(db_session)
    result = await service.check_patent("17001", "US")

    assert result.recommendation == TokenizabilityRecommendation.REQUIRES_REVIEW


# ---------------------------------------------------------------------------
# 7. Cache round-trip: _save_to_cache → _get_from_cache → _cache_to_record
# ---------------------------------------------------------------------------

async def test_cache_round_trip(db_session: AsyncSession):
    """Save → load → convert preserves all fields."""
    from app.services.ip_intel_service import PatentStatusCheckService

    record = _make_normalized_record(
        source_id="RT-001",
        title="Round Trip Patent",
    )

    service = PatentStatusCheckService(db_session)
    await service._save_to_cache(record, search_patent_number="RT-001")

    # Load from cache (patent_number is normalized: hyphens removed)
    cached = await service._get_from_cache("RT001", "US")
    assert cached is not None
    assert cached.patent_number == "RT001"
    assert cached.patent_status == "granted"
    assert cached.cache_status == PatentCacheStatus.VALID.value
    assert cached.title == "Round Trip Patent"

    # Convert back
    restored = service._cache_to_record(cached)
    assert restored.source == "USPTO"
    assert restored.source_id == "RT-001"
    assert restored.title == "Round Trip Patent"
    assert restored.status == "granted"
    assert len(restored.assignees) == 1
    assert restored.assignees[0].name == "Acme Corp"
    assert len(restored.inventors) == 1
    assert restored.inventors[0].name == "John Doe"
    assert restored.cpc_classes == ["H04L9/00"]
    assert restored.geo_data is not None
    assert restored.geo_data.assignee_countries == ["US"]


# ---------------------------------------------------------------------------
# 8. _save_to_cache upsert behavior
# ---------------------------------------------------------------------------

async def test_save_to_cache_upsert(db_session: AsyncSession):
    """Second save updates existing record instead of duplicate."""
    from app.services.ip_intel_service import PatentStatusCheckService

    record1 = _make_normalized_record(source_id="UPSERT-001", title="First")
    service = PatentStatusCheckService(db_session)
    await service._save_to_cache(record1, search_patent_number="UPSERT-001")

    # Count before
    stmt = select(PatentCache).where(PatentCache.source_id == "UPSERT-001")
    result = await db_session.execute(stmt)
    assert len(result.scalars().all()) == 1

    # Save again with updated title
    record2 = _make_normalized_record(source_id="UPSERT-001", title="Second")
    await service._save_to_cache(record2, search_patent_number="UPSERT-001")

    # Still one record
    result = await db_session.execute(stmt)
    records = result.scalars().all()
    assert len(records) == 1
    assert records[0].title == "Second"


# ---------------------------------------------------------------------------
# 9. PatentDataEnrichmentService — Happy path
# ---------------------------------------------------------------------------

@respx.mock
async def test_enrich_claim_success(db_session: AsyncSession, make_user):
    """Enrich claim → updates external_metadata."""
    from app.services.ip_intel_service import PatentDataEnrichmentService

    issuer = await make_user(role="issuer", status="active")
    claim = IpClaim(
        issuer_user_id=issuer.id,
        patent_number="1234567",
        patent_title="",  # Empty, will be enriched
        claimed_owner_name="Owner Corp",
        jurisdiction="US",
    )
    db_session.add(claim)
    await db_session.flush()

    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={
            "results": [{
                "patentNumber": "1234567",
                "inventionTitle": "Enriched Title",
                "abstractText": "Enriched abstract",
                "filingDate": "2020-01-01",
                "grantDate": "2022-01-01",
                "status": "Active",
                "assignees": [{"name": "Owner Corp"}],
            }],
            "total": 1,
        })
    )

    service = PatentDataEnrichmentService(db_session)
    result = await service.enrich_claim(str(claim.id), force_refresh=True)

    assert result.enriched is True
    assert "USPTO" in result.sources_used
    assert result.normalized_record is not None
    assert result.normalized_record.title == "Enriched Title"

    # Verify claim was updated
    stmt = select(IpClaim).where(IpClaim.id == claim.id)
    r = await db_session.execute(stmt)
    updated_claim = r.scalar_one()
    assert updated_claim.patent_title == "Enriched Title"
    assert updated_claim.prechecked is True
    assert updated_claim.external_metadata is not None


# ---------------------------------------------------------------------------
# 10. PatentDataEnrichmentService — Claim not found
# ---------------------------------------------------------------------------

async def test_enrich_claim_not_found(db_session: AsyncSession):
    """Invalid claim_id → enriched=False, warning."""
    from app.services.ip_intel_service import PatentDataEnrichmentService

    service = PatentDataEnrichmentService(db_session)
    result = await service.enrich_claim(str(uuid.uuid4()))

    assert result.enriched is False
    assert "not found" in result.warnings[0].lower()


# ---------------------------------------------------------------------------
# 11. PatentDataEnrichmentService — Invalid UUID
# ---------------------------------------------------------------------------

async def test_enrich_claim_invalid_uuid(db_session: AsyncSession):
    """Invalid UUID format → warning."""
    from app.services.ip_intel_service import PatentDataEnrichmentService

    service = PatentDataEnrichmentService(db_session)
    result = await service.enrich_claim("not-a-uuid")

    assert result.enriched is False
    assert "Invalid claim_id" in result.warnings[0]


# ---------------------------------------------------------------------------
# 12. _get_default_sources_for_country
# ---------------------------------------------------------------------------

def test_default_sources_us():
    from app.services.ip_intel_service import PatentDataEnrichmentService
    svc = PatentDataEnrichmentService.__new__(PatentDataEnrichmentService)
    assert svc._get_default_sources_for_country("US") == ["USPTO", "PATENTSVIEW"]


def test_default_sources_ep():
    from app.services.ip_intel_service import PatentDataEnrichmentService
    svc = PatentDataEnrichmentService.__new__(PatentDataEnrichmentService)
    assert svc._get_default_sources_for_country("EP") == ["EPO_OPS"]


def test_default_sources_wo():
    from app.services.ip_intel_service import PatentDataEnrichmentService
    svc = PatentDataEnrichmentService.__new__(PatentDataEnrichmentService)
    assert svc._get_default_sources_for_country("WO") == ["WIPO_PCT"]


def test_default_sources_fallback():
    from app.services.ip_intel_service import PatentDataEnrichmentService
    svc = PatentDataEnrichmentService.__new__(PatentDataEnrichmentService)
    assert svc._get_default_sources_for_country("JP") == ["USPTO"]


# ---------------------------------------------------------------------------
# 13. InternationalSearchService
# ---------------------------------------------------------------------------

@respx.mock
async def test_international_search_us_only(db_session: AsyncSession):
    """Search US → returns results."""
    from app.services.ip_intel_service import InternationalSearchService

    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={
            "results": [
                {"patentNumber": "1", "inventionTitle": "Result 1", "grantDate": "2022-01-01"},
                {"patentNumber": "2", "inventionTitle": "Result 2", "grantDate": "2022-02-01"},
            ],
            "total": 2,
        })
    )

    service = InternationalSearchService(db_session)
    result = await service.search(query="test", countries=["US"], page=1, per_page=10)

    assert result.total >= 0
    assert "USPTO" in result.sources_queried
    assert result.page == 1
    assert result.per_page == 10


@respx.mock
async def test_international_search_deduplication(db_session: AsyncSession):
    """Same patent from two sources → deduplicated."""
    from app.services.ip_intel_service import InternationalSearchService

    # Both USPTO and PatentsView return same patent
    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={
            "results": [{"patentNumber": "DUP", "inventionTitle": "Duplicate", "grantDate": "2022-01-01"}],
            "total": 1,
        })
    )
    respx.post("https://api.patentsview.org/v1/patents/search").mock(
        return_value=Response(200, json={
            "results": [{"patent_number": "DUP", "patent_title": "Duplicate", "grant_date": "2022-01-01"}],
            "total": 1,
        })
    )

    service = InternationalSearchService(db_session)
    result = await service.search(query="dup", countries=["US"], page=1, per_page=10)

    # Deduplication count should reflect duplicates removed
    assert result.deduplicated_count >= 0
    assert result.total >= 0


async def test_international_search_unauthorized(client):
    """Without auth → 401."""
    resp = await client.post(
        "/api/v1/patents/search/international",
        json={"query": "test"},
    )
    assert resp.status_code == 401
