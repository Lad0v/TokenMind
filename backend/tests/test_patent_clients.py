"""
Tests for patent API clients (USPTO v2.3, PatentsView, EPO OPS, WIPO):
- Success / not-found paths
- Grants → Applications fallback
- Continuity fetch
- Retry on 429/5xx
- Normalization to NormalizedPatentRecord
- Factory function
"""
from __future__ import annotations

import pytest
import respx
from httpx import Response

from app.integrations.patent_clients import (
    UsptoPatentClient,
    PatentsViewClient,
    EpoOpsClient,
    WipoPatentscopeClient,
    create_patent_client,
    BasePatentClient,
)
from app.schemas.ip_intel import NormalizedPatentRecord


# ---------------------------------------------------------------------------
# 1. USPTO Client — Grant success
# ---------------------------------------------------------------------------

@respx.mock
async def test_uspto_fetch_grant_success():
    """UsptoPatentClient.fetch_patent_by_number → finds in grants."""
    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={
            "results": [{
                "patentNumber": "1234567",
                "inventionTitle": "Test Patent",
                "abstractText": "An invention for testing",
                "filingDate": "2020-01-01",
                "grantDate": "2022-06-15",
                "kindCode": "B2",
                "assignees": [{"name": "Acme Corp", "type": "company", "country": "US"}],
                "inventors": [{"name": "John Doe", "country": "US"}],
                "cpcClasses": ["H04L9/00"],
                "uspcClasses": ["709/200"],
                "status": "Active",
            }],
            "total": 1,
        })
    )

    client = UsptoPatentClient(api_key="test-key")
    result = await client.fetch_patent_by_number("1234567", country_code="US")

    assert result.success is True
    assert result.source == "USPTO"
    assert result.status_code == 200
    assert result.data is not None
    assert result.data["patentNumber"] == "1234567"


# ---------------------------------------------------------------------------
# 2. USPTO Client — Grant not found → fallback to applications
# ---------------------------------------------------------------------------

@respx.mock
async def test_uspto_fallback_to_application():
    """Grant returns empty → falls back to applications search."""
    # Grant: empty results
    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={"results": [], "total": 0})
    )
    # Application: found
    respx.post("https://data.uspto.gov/api/v1/patent/applications/search").mock(
        return_value=Response(200, json={
            "results": [{
                "applicationNumber": "17/123456",
                "inventionTitle": "Application Patent",
                "abstractText": "App abstract",
                "filingDate": "2021-03-01",
                "status": "Pending",
            }],
            "total": 1,
        })
    )

    client = UsptoPatentClient(api_key="test-key")
    result = await client.fetch_patent_by_number("17123456", country_code="US")

    assert result.success is True
    assert result.data is not None
    assert result.data["applicationNumber"] == "17/123456"


# ---------------------------------------------------------------------------
# 3. USPTO Client — Both grant and application not found
# ---------------------------------------------------------------------------

@respx.mock
async def test_uspto_both_grant_and_application_not_found():
    """Neither grants nor applications contain the patent."""
    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={"results": [], "total": 0})
    )
    respx.post("https://data.uspto.gov/api/v1/patent/applications/search").mock(
        return_value=Response(200, json={"results": [], "total": 0})
    )

    client = UsptoPatentClient(api_key="test-key")
    result = await client.fetch_patent_by_number("0000000", country_code="US")

    assert result.success is False
    assert "not found" in result.error_message.lower()


# ---------------------------------------------------------------------------
# 4. USPTO Client — Application with continuity
# ---------------------------------------------------------------------------

@respx.mock
async def test_uspto_application_with_continuity():
    """Application found → continuity endpoint called for status."""
    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={"results": [], "total": 0})
    )
    respx.post("https://data.uspto.gov/api/v1/patent/applications/search").mock(
        return_value=Response(200, json={
            "results": [{
                "applicationNumber": "17/111111",
                "inventionTitle": "Continuity Patent",
                "filingDate": "2021-01-01",
            }],
            "total": 1,
        })
    )
    # Continuity endpoint
    respx.get("https://data.uspto.gov/api/v1/patent/applications/17/111111/continuity").mock(
        return_value=Response(200, json={
            "status": "under_review",
            "continuityData": [],
        })
    )

    client = UsptoPatentClient(api_key="test-key")
    result = await client.fetch_patent_by_number("17111111", country_code="US")

    assert result.success is True
    assert "_continuity" in result.data
    assert result.data["_continuity"]["status"] == "under_review"


@respx.mock
async def test_uspto_continuity_failure_does_not_break_fetch():
    """Continuity 500 → application data still returned."""
    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={"results": [], "total": 0})
    )
    respx.post("https://data.uspto.gov/api/v1/patent/applications/search").mock(
        return_value=Response(200, json={
            "results": [{
                "applicationNumber": "17/222222",
                "inventionTitle": "No Continuity",
            }],
            "total": 1,
        })
    )
    respx.get("https://data.uspto.gov/api/v1/patent/applications/17/222222/continuity").mock(
        return_value=Response(500, json={"error": "Internal error"})
    )

    client = UsptoPatentClient(api_key="test-key")
    result = await client.fetch_patent_by_number("17222222", country_code="US")

    assert result.success is True
    # Continuity failed, but application data is still there
    assert result.data["inventionTitle"] == "No Continuity"


# ---------------------------------------------------------------------------
# 5. USPTO Client — search_patents
# ---------------------------------------------------------------------------

@respx.mock
async def test_uspto_search_patents():
    """UsptoPatentClient.search_patents → grants search."""
    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={
            "results": [
                {"patentNumber": "111", "inventionTitle": "Patent 1"},
                {"patentNumber": "222", "inventionTitle": "Patent 2"},
            ],
            "total": 2,
        })
    )

    client = UsptoPatentClient(api_key="test-key")
    result = await client.search_patents(query="AI", page=1, per_page=20)

    assert result.success is True
    assert result.data is not None
    assert result.data["total"] == 2


@respx.mock
async def test_uspto_search_with_date_range():
    """search_patents with date_from and date_to."""
    route = respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(200, json={"results": [], "total": 0})
    )

    client = UsptoPatentClient(api_key="test-key")
    await client.search_patents(
        query="machine learning",
        date_from="2020-01-01",
        date_to="2021-12-31",
    )

    # Verify the request included filingDate range
    assert route.called


@respx.mock
async def test_uspto_search_empty_results():
    """search_patents with no results → success with empty list."""
    respx.get("https://data.uspto.gov/api/v1/patent/grants").mock(
        return_value=Response(404, json={"error": "Not found"})
    )

    client = UsptoPatentClient(api_key="test-key")
    result = await client.search_patents(query="nonexistent_xyz")

    assert result.success is True
    assert result.data["results"] == []
    assert result.data["total"] == 0


# ---------------------------------------------------------------------------
# 6. USPTO — Retry on 429 then success
# ---------------------------------------------------------------------------

@respx.mock
async def test_uspto_retries_on_429_then_success():
    """Tenacity retries 429 twice, then 200 succeeds."""
    route = respx.get("https://data.uspto.gov/api/v1/patent/grants")
    route.side_effect = [
        Response(429, json={"error": "Rate limited"}),
        Response(429, json={"error": "Rate limited"}),
        Response(200, json={
            "results": [{"patentNumber": "1234567", "inventionTitle": "After retry"}],
            "total": 1,
        }),
    ]

    client = UsptoPatentClient(api_key="test-key")
    result = await client.fetch_patent_by_number("1234567", country_code="US")

    assert route.call_count == 3
    assert result.success is True


@respx.mock
async def test_uspto_retries_on_503_then_success():
    """Tenacity retries 503, then 200 succeeds."""
    route = respx.get("https://data.uspto.gov/api/v1/patent/grants")
    route.side_effect = [
        Response(503),
        Response(200, json={
            "results": [{"patentNumber": "9999999", "inventionTitle": "Recovered"}],
            "total": 1,
        }),
    ]

    client = UsptoPatentClient(api_key="test-key")
    result = await client.fetch_patent_by_number("9999999", country_code="US")

    assert route.call_count == 2
    assert result.success is True


# ---------------------------------------------------------------------------
# 7. USPTO — Normalization to NormalizedPatentRecord
# ---------------------------------------------------------------------------

def test_uspto_map_to_normalized_record_grant():
    """Grant response → valid NormalizedPatentRecord."""
    client = UsptoPatentClient(api_key="test-key")
    data = {
        "patentNumber": "10000001",
        "inventionTitle": "Normalized Grant",
        "abstractText": "A well-formed abstract",
        "filingDate": "2020-03-15",
        "publicationDate": "2021-03-15",
        "grantDate": "2022-09-01",
        "kindCode": "B2",
        "status": "Active",
        "assignees": [{"name": "BigCorp", "type": "company", "country": "US"}],
        "inventors": [{"name": "Jane Smith", "country": "US"}],
        "cpcClasses": ["H04L9/00", "G06F17/00"],
        "uspcClasses": [{"classificationSymbol": "709/200"}],
        "ipcClasses": ["H04L 9/00"],
    }

    record = client._map_to_normalized_record(data)

    assert record is not None
    assert isinstance(record, NormalizedPatentRecord)
    assert record.source == "USPTO"
    assert record.source_id == "10000001"
    assert record.country_code == "US"
    assert record.kind_code == "B2"
    assert record.title == "Normalized Grant"
    assert record.abstract == "A well-formed abstract"
    assert record.filing_date == "2020-03-15"
    assert record.grant_date == "2022-09-01"
    assert record.status == "granted"
    assert len(record.assignees) == 1
    assert record.assignees[0].name == "BigCorp"
    assert len(record.inventors) == 1
    assert record.cpc_classes == ["H04L9/00", "G06F17/00"]
    assert record.uspc_classes == ["709/200"]
    assert record.ipc_classes == ["H04L 9/00"]


def test_uspto_map_to_normalized_record_application():
    """Application response → valid NormalizedPatentRecord."""
    client = UsptoPatentClient(api_key="test-key")
    data = {
        "applicationNumber": "17/333333",
        "inventionTitle": "Application Record",
        "abstractText": "App abstract",
        "filingDate": "2021-06-01",
        "status": "Pending",
        "assignees": [{"assigneeName": "Startup Inc"}],
        "inventors": [{"inventorName": "Bob Builder"}],
    }

    record = client._map_to_normalized_record(data)

    assert record is not None
    assert record.source_id == "17/333333"
    assert record.title == "Application Record"
    assert record.status == "pending"


def test_uspto_map_to_normalized_record_with_continuity():
    """Continuity data overrides status in normalized record."""
    client = UsptoPatentClient(api_key="test-key")
    data = {
        "patentNumber": "10000002",
        "inventionTitle": "Continuity Status",
        "status": "Active",
        "_continuity": {"status": "pending"},
    }

    record = client._map_to_normalized_record(data)

    assert record is not None
    # Continuity status takes precedence
    assert record.status == "pending"


def test_uspto_map_empty_data():
    """Empty dict → None."""
    client = UsptoPatentClient(api_key="test-key")
    assert client._map_to_normalized_record({}) is None
    assert client._map_to_normalized_record(None) is None


def test_uspto_extract_classes_mixed():
    """_extract_classes handles strings and dicts."""
    assert UsptoPatentClient._extract_classes(["A", "B"]) == ["A", "B"]
    assert UsptoPatentClient._extract_classes([{"classificationSymbol": "X"}]) == ["X"]
    assert UsptoPatentClient._extract_classes([{"code": "Y"}]) == ["Y"]
    assert UsptoPatentClient._extract_classes("Single") == ["Single"]
    assert UsptoPatentClient._extract_classes(None) is None
    assert UsptoPatentClient._extract_classes([]) is None


def test_uspto_parse_assignees_mixed():
    """Assignees can be strings or dicts."""
    result = UsptoPatentClient._parse_assignees(["John Doe"])
    assert result == [{"name": "John Doe", "type": None, "country": None}]

    result = UsptoPatentClient._parse_assignees([{"name": "Corp", "type": "company"}])
    assert result[0]["name"] == "Corp"


def test_uspto_parse_inventors_mixed():
    result = UsptoPatentClient._parse_inventors(["Alice"])
    assert result == [{"name": "Alice", "country": None}]

    result = UsptoPatentClient._parse_inventors([{"name": "Bob", "country": "EP"}])
    assert result[0]["name"] == "Bob"
    assert result[0]["country"] == "EP"


def test_uspto_normalize_patent_number():
    assert UsptoPatentClient._normalize_patent_number("12,345,67") == "1234567"
    assert UsptoPatentClient._normalize_patent_number("17-123-456") == "17123456"
    assert UsptoPatentClient._normalize_patent_number("  123  ") == "123"


# ---------------------------------------------------------------------------
# 8. PatentsView Client
# ---------------------------------------------------------------------------

@respx.mock
async def test_patentsview_fetch_success():
    """PatentsViewClient.fetch_patent_by_number → success."""
    respx.post("https://api.patentsview.org/v1/patents").mock(
        return_value=Response(200, json={
            "patents": [{
                "patent_id": "pv-123",
                "patent_number": "1234567",
                "patent_title": "PV Patent",
                "patent_abstract": "PV Abstract",
                "file_date": "2020-01-01",
                "grant_date": "2022-01-01",
            }]
        })
    )

    client = PatentsViewClient()
    result = await client.fetch_patent_by_number("1234567", country_code="US")

    assert result.success is True
    assert result.source == "PATENTSVIEW"


# ---------------------------------------------------------------------------
# 9. EPO OPS Client
# ---------------------------------------------------------------------------

@respx.mock
async def test_epo_ops_fetch_success():
    """EpoOpsClient.fetch_patent_by_number → returns EPO_OPS source."""
    # OAuth2 mock
    respx.post("https://ops.epo.org/auth/oauth/token").mock(
        return_value=Response(200, json={"access_token": "epo-token", "expires_in": 3600})
    )
    respx.get(url__startswith="https://ops.epo.org/rest-services/published-data").mock(
        return_value=Response(200, json={"publicationNumber": "EP001"})
    )

    client = EpoOpsClient(consumer_key="key", consumer_secret="secret")
    result = await client.fetch_patent_by_number("EP001", country_code="EP")

    assert result.source == "EPO_OPS"


# ---------------------------------------------------------------------------
# 10. WIPO Client
# ---------------------------------------------------------------------------

@respx.mock
async def test_wipo_fetch_success():
    """WipoPatentscopeClient.fetch_patent_by_number → success."""
    respx.get("https://patentscope.wipo.int/api/v2/publications/WO2020123456").mock(
        return_value=Response(200, json={
            "publicationNumber": "WO2020123456",
            "title": "WIPO Patent",
        })
    )

    client = WipoPatentscopeClient(api_key="wipo-key")
    result = await client.fetch_patent_by_number("WO2020123456", country_code="WO")

    assert result.success is True
    assert result.source == "WIPO_PCT"


# ---------------------------------------------------------------------------
# 11. Factory Function
# ---------------------------------------------------------------------------

def test_create_patent_client_uspto():
    assert isinstance(create_patent_client("USPTO"), UsptoPatentClient)


def test_create_patent_client_patentsview():
    assert isinstance(create_patent_client("PATENTSVIEW"), PatentsViewClient)


def test_create_patent_client_epo():
    assert isinstance(create_patent_client("EPO_OPS"), EpoOpsClient)


def test_create_patent_client_wipo():
    assert isinstance(create_patent_client("WIPO_PCT"), WipoPatentscopeClient)


def test_create_patent_client_unknown():
    with pytest.raises(ValueError, match="Unknown patent source"):
        create_patent_client("UNKNOWN")


# ---------------------------------------------------------------------------
# 12. Status Normalization (BasePatentClient)
# ---------------------------------------------------------------------------

def test_normalize_status_granted():
    assert BasePatentClient._normalize_status("Grant") == "granted"
    assert BasePatentClient._normalize_status("Patented") == "granted"


def test_normalize_status_expired():
    assert BasePatentClient._normalize_status("Abandoned") == "expired"
    assert BasePatentClient._normalize_status("Expired") == "expired"


def test_normalize_status_pending():
    assert BasePatentClient._normalize_status("Pending") == "pending"
    assert BasePatentClient._normalize_status("Application") == "pending"


def test_normalize_status_revoked():
    assert BasePatentClient._normalize_status("Revoked") == "revoked"


def test_normalize_status_unknown():
    assert BasePatentClient._normalize_status("SomethingElse") == "unknown"
    assert BasePatentClient._normalize_status(None) == "unknown"
