"""Seed mock data into database for testing."""
import asyncio
import sys
sys.path.insert(0, '.')

from app.core.database import AsyncSessionLocal
from app.models.user import User, Profile, WalletLink, UserRole, UserStatus
from app.models.ip_claim import IpClaim, IpClaimStatus
from app.models.patent import Patent, PatentStatus

async def seed():
    async with AsyncSessionLocal() as db:
        # === Users ===
        users = [
            User(
                id="a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1",
                email="mock.investor@test.com",
                password_hash=None,
                role=UserRole.investor.value,
                status=UserStatus.active.value,
            ),
            User(
                id="b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2",
                email="mock.issuer@test.com",
                password_hash=None,
                role=UserRole.issuer.value,
                status=UserStatus.active.value,
            ),
            User(
                id="c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3",
                email="mock.admin@test.com",
                password_hash=None,
                role=UserRole.admin.value,
                status=UserStatus.active.value,
            ),
        ]
        for u in users:
            db.merge(u)
        await db.flush()

        # === Profiles ===
        profiles = [
            Profile(user_id="a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1", full_name="Mock Investor", country="US"),
            Profile(user_id="b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2", full_name="Mock Issuer", country="RU", organization_name="Test Corp"),
            Profile(user_id="c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3", full_name="Mock Admin", country="GB"),
        ]
        for p in profiles:
            db.merge(p)
        await db.flush()

        # === Wallets (valid base58 addresses) ===
        wallets = [
            WalletLink(user_id="a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1", wallet_address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAs1", network="solana", is_primary=True),
            WalletLink(user_id="b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2", wallet_address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAs2", network="solana", is_primary=True),
            WalletLink(user_id="c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3", wallet_address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRrJosgAs3", network="solana", is_primary=True),
        ]
        for w in wallets:
            db.merge(w)
        await db.flush()

        # === Patents ===
        patents = [
            Patent(id="11111111-1111-1111-1111-111111111111", owner_user_id="b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2", patent_number="US9876543", jurisdiction="US", title="Test Patent Alpha", abstract="A method for testing", status=PatentStatus.approved.value),
            Patent(id="22222222-2222-2222-2222-222222222222", owner_user_id="b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2", patent_number="US8765432", jurisdiction="US", title="Test Patent Beta", abstract="Another test patent", status=PatentStatus.submitted.value),
        ]
        for p in patents:
            db.merge(p)
        await db.flush()

        # === IP Claims ===
        claims = [
            IpClaim(id="33333333-3333-3333-3333-333333333333", issuer_user_id="b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2", patent_number="US9876543", patent_title="Test Patent Alpha", claimed_owner_name="Mock Issuer", description="Test claim", jurisdiction="US", status=IpClaimStatus.approved.value, prechecked=True),
            IpClaim(id="44444444-4444-4444-4444-444444444444", issuer_user_id="b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2", patent_number="US8765432", patent_title="Test Patent Beta", claimed_owner_name="Mock Issuer", description="Another claim", jurisdiction="US", status=IpClaimStatus.submitted.value, prechecked=False),
        ]
        for c in claims:
            db.merge(c)
        await db.flush()

        await db.commit()
        print("✅ Mock data seeded successfully!")
        print(f"  - 3 users (investor, issuer, admin)")
        print(f"  - 3 profiles")
        print(f"  - 3 wallets (Solana)")
        print(f"  - 2 patents")
        print(f"  - 2 IP claims")

if __name__ == "__main__":
    asyncio.run(seed())
