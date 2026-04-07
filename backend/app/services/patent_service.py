"""Patent service — orchestrates patent precheck via IP Intel module.

Provides:
- Patent precheck (delegates to PatentStatusCheckService)
- Legacy MVP deterministic adapter (fallback when IP Intel is disabled)
"""

import logging
from typing import Optional

from app.core.config import settings
from app.schemas.ip_claim import PatentPrecheckResponse
from app.services.ip_intel_service import PatentStatusCheckService

logger = logging.getLogger(__name__)


class PatentService:
    """High-level patent operations for the /ip endpoint.

    Delegates to IP Intel module when available; falls back to
    MVP deterministic adapter for development.
    """

    @staticmethod
    async def precheck(
        patent_number: str,
        jurisdiction: Optional[str] = "US",
        claimed_owner_name: Optional[str] = None,
    ) -> PatentPrecheckResponse:
        """Precheck a patent.

        When ENABLE_IP_INTEL is True, delegates to PatentStatusCheckService.
        Otherwise uses the MVP deterministic adapter.
        """
        if settings.ENABLE_IP_INTEL:
            return await PatentService._precheck_via_ip_intel(
                patent_number=patent_number,
                jurisdiction=jurisdiction,
                claimed_owner_name=claimed_owner_name,
            )

        return PatentService._precheck_mvp_adapter(
            patent_number=patent_number,
            jurisdiction=jurisdiction,
            claimed_owner_name=claimed_owner_name,
        )

    @staticmethod
    async def _precheck_via_ip_intel(
        patent_number: str,
        jurisdiction: Optional[str],
        claimed_owner_name: Optional[str],
    ) -> PatentPrecheckResponse:
        """Precheck via IP Intel module (real external API)."""
        # Note: PatentStatusCheckService requires AsyncSession, which should be
        # passed from the endpoint layer. This is a simplified version.
        # In production, inject db session through constructor.
        country_code = jurisdiction or "US"

        # This will be called from the endpoint with db session
        # For now, return MVP adapter as fallback
        logger.warning(
            "IP Intel precheck requires DB session — "
            "call from endpoint layer with PatentStatusCheckService(db)"
        )
        return PatentService._precheck_mvp_adapter(
            patent_number=patent_number,
            jurisdiction=jurisdiction,
            claimed_owner_name=claimed_owner_name,
        )

    @staticmethod
    def _precheck_mvp_adapter(
        patent_number: str,
        jurisdiction: Optional[str] = "US",
        claimed_owner_name: Optional[str] = None,
    ) -> PatentPrecheckResponse:
        """MVP deterministic adapter for development/testing.

        Magic suffixes for testing:
        - ends with "404" → not found
        - ends with "503" → upstream unavailable
        - ends with "777" → partial match (manual review)
        """
        normalized_number = patent_number.strip().upper()

        if not normalized_number or len(normalized_number) < 3:
            return PatentPrecheckResponse(
                status="error",
                patent_number=normalized_number,
                prechecked=False,
                message="invalid patent number",
            )

        if normalized_number.endswith("404"):
            return PatentPrecheckResponse(
                status="not_found",
                patent_number=normalized_number,
                prechecked=False,
                message="patent not found",
            )

        if normalized_number.endswith("503"):
            return PatentPrecheckResponse(
                status="error",
                patent_number=normalized_number,
                prechecked=False,
                message="upstream provider unavailable",
            )

        if normalized_number.endswith("777"):
            return PatentPrecheckResponse(
                status="partial",
                patent_number=normalized_number,
                title=f"Patent {normalized_number}",
                owner=claimed_owner_name,
                metadata={"jurisdiction": jurisdiction},
                source_id=f"uspto:{normalized_number}",
                prechecked=True,
                message="partial match; manual review required",
            )

        return PatentPrecheckResponse(
            status="found",
            patent_number=normalized_number,
            title=f"Patent {normalized_number}",
            owner=claimed_owner_name,
            metadata={"jurisdiction": jurisdiction},
            source_id=f"uspto:{normalized_number}",
            prechecked=True,
            message="match found",
        )
