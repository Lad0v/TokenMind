# Import order matters: user models first (referenced by other domains via FK)
from app.models.user import (  # noqa: F401
    User, Profile, KYCCase, SanctionCheck, WalletLink, OTPCode, VerificationCase,
    UserRole, UserStatus, KYCCaseStatus, KYCRiskLevel, SanctionCheckStatus, VerificationStatus,
)
from app.models.patent import (  # noqa: F401
    Patent, PatentDocument, PatentReview,
    PatentStatus, DocumentType, ReviewDecision,
)
from app.models.analytics import (  # noqa: F401
    UserMetricsDaily, PatentMetricsDaily, KYCFunnelStats,
    KYCFunnelStep,
)
from app.models.common import (  # noqa: F401
    AuditLog, WebhookEvent,
    WebhookEventStatus,
)
from app.models.ip_claim import (  # noqa: F401
    IpClaim,
    IpDocument,
    IpReview,
    IpClaimStatus,
    IpReviewDecision,
    TokenRevocation,
)
from app.models.ip_intel import (  # noqa: F401
    PatentCache,
    PatentSearchCache,
    PatentCacheSource,
    PatentCacheStatus,
)
from app.models.marketplace import (  # noqa: F401
    MarketplaceListing,
    MarketplacePurchase,
    MarketplaceListingStatus,
    MarketplacePurchaseStatus,
)

__all__ = [
    # Users domain
    "User", "Profile", "KYCCase", "SanctionCheck", "WalletLink", "OTPCode", "VerificationCase",
    "UserRole", "UserStatus", "KYCCaseStatus", "KYCRiskLevel", "SanctionCheckStatus", "VerificationStatus",
    # Patents domain
    "Patent", "PatentDocument", "PatentReview",
    "PatentStatus", "DocumentType", "ReviewDecision",
    # Analytics domain
    "UserMetricsDaily", "PatentMetricsDaily", "KYCFunnelStats",
    "KYCFunnelStep",
    # Cross-domain
    "AuditLog", "WebhookEvent",
    "WebhookEventStatus",
    # IP claims domain
    "IpClaim",
    "IpDocument",
    "IpReview",
    "IpClaimStatus",
    "IpReviewDecision",
    "TokenRevocation",
    # IP intelligence domain
    "PatentCache",
    "PatentSearchCache",
    "PatentCacheSource",
    "PatentCacheStatus",
    # Marketplace domain
    "MarketplaceListing",
    "MarketplacePurchase",
    "MarketplaceListingStatus",
    "MarketplacePurchaseStatus",
]
