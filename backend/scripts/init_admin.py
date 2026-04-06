"""Script to create initial admin user.

Usage:
    python scripts/init_admin.py
"""

import asyncio
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select

# Import all models to ensure SQLAlchemy can resolve relationships
import app.models.user  # noqa: F401
import app.models.patent  # noqa: F401
import app.models.ip_claim  # noqa: F401
import app.models.ip_intel  # noqa: F401
import app.models.analytics  # noqa: F401
import app.models.common  # noqa: F401

from app.core.database import AsyncSessionLocal, engine
from app.models.user import User, UserRole, UserStatus
from app.services.user_service import UserService


async def create_admin(email: str, password: str) -> None:
    """Create admin user if it doesn't exist."""
    async with AsyncSessionLocal() as db:
        # Check if admin already exists
        result = await db.execute(select(User).where(User.email == email.lower().strip()))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            print(f"Admin user '{email}' already exists (ID: {existing_user.id})")
            return

        # Create admin user
        user = User(
            email=email.lower().strip(),
            password_hash=UserService.hash_password(password),
            role=UserRole.admin.value,
            status=UserStatus.active.value,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        print(f"✅ Admin user created successfully!")
        print(f"   Email: {email}")
        print(f"   ID: {user.id}")
        print(f"   Role: {user.role}")
        print(f"   Status: {user.status}")


async def main():
    from app.core.config import settings

    admin_email = os.getenv("ADMIN_EMAIL", "admin@ipclaim.local")
    admin_password = os.getenv("ADMIN_PASSWORD", "Mix-100x")

    print("Initializing admin user...")
    print(f"Using DATABASE_URL: {settings.DATABASE_URL[:30]}...")

    try:
        await create_admin(admin_email, admin_password)
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
