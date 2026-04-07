from fastapi import APIRouter

from app.api.v1.endpoints import auth
from app.api.v1.endpoints import ip_claims
from app.api.v1.endpoints import ip_intel
from app.api.v1.endpoints import patents
from app.api.v1.endpoints import users
from app.api.v1.endpoints import admin_users
from app.api.v1.endpoints import admin_patents
from app.api.v1.endpoints import admin_verification
from app.api.v1.endpoints import admin_audit
from app.api.v1.endpoints import marketplace

router = APIRouter()


@router.get("/ping", tags=["Utils"])
async def ping():
    return {"message": "pong"}


router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(users.router, prefix="/users", tags=["Users"])
router.include_router(patents.router, prefix="/ip", tags=["IP Check"])
router.include_router(ip_claims.router, prefix="/ip-claims", tags=["IP Claims"])
router.include_router(ip_intel.router, prefix="/patents", tags=["IP Intelligence"])
router.include_router(marketplace.router, prefix="/marketplace", tags=["Marketplace"])

# Admin endpoints
router.include_router(admin_users.router, prefix="/users", tags=["admin-users"])
router.include_router(admin_patents.router, prefix="/admin/patents", tags=["admin-patents"])
router.include_router(
    admin_verification.router,
    prefix="/admin/verification-cases",
    tags=["admin-verification"],
)
router.include_router(admin_audit.router, prefix="/admin/audit-logs", tags=["admin-audit"])
