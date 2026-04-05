import enum
import datetime

from sqlalchemy import Date, Integer, Index, PrimaryKeyConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class KYCFunnelStep(str, enum.Enum):
    registered = "registered"
    kyc_started = "kyc_started"
    kyc_manual_review = "kyc_manual_review"
    kyc_approved = "kyc_approved"
    kyc_rejected = "kyc_rejected"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class UserMetricsDaily(Base):
    """Aggregated daily user metrics; one row per day."""
    __tablename__ = "user_metrics_daily"

    date: Mapped[datetime.date] = mapped_column(Date, primary_key=True)
    total_users: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    new_users: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active_users: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    kyc_started: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    kyc_approved: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PatentMetricsDaily(Base):
    """Aggregated daily patent metrics; one row per day."""
    __tablename__ = "patent_metrics_daily"

    date: Mapped[datetime.date] = mapped_column(Date, primary_key=True)
    total_patents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    new_patents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    patents_under_review: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    patents_approved: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    patents_rejected: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class KYCFunnelStats(Base):
    """Aggregated KYC funnel stats per period and step; composite PK."""
    __tablename__ = "kyc_funnel_stats"
    __table_args__ = (
        PrimaryKeyConstraint("period_start", "period_end", "step_name"),
        Index("ix_kyc_funnel_stats_step", "step_name"),
        Index("ix_kyc_funnel_stats_period", "period_start", "period_end"),
    )

    period_start: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    period_end: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    step_name: Mapped[str] = mapped_column(
        SAEnum(*[s.value for s in KYCFunnelStep], name="kyc_funnel_step"),
        nullable=False,
    )
    users_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
