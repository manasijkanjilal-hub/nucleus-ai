"""Module C — Attribution Engine API endpoints.

Provides campaign management, spend tracking, conversion events,
and attribution metric calculations (ROAS, CAC, LTV, dashboard).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func as sa_func, and_, delete, case
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Campaign, SpendLog, ConversionEvent

logger = logging.getLogger(__name__)

# ============================================================================
# Pydantic Schemas
# ============================================================================

# ---- Campaign Schemas ----

class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    brand_id: str = Field(..., description="UUID of the brand profile")
    channel: str = Field(..., min_length=1, max_length=100)
    status: str = Field(default="draft", pattern="^(draft|active|paused|completed)$")
    budget: Optional[float] = Field(default=0.0, ge=0)
    start_date: Optional[str] = Field(default=None, description="ISO date string")
    end_date: Optional[str] = Field(default=None, description="ISO date string")
    goal: Optional[str] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    channel: Optional[str] = Field(default=None, max_length=100)
    status: Optional[str] = Field(default=None, pattern="^(draft|active|paused|completed)$")
    budget: Optional[float] = Field(default=None, ge=0)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    goal: Optional[str] = None


class CampaignResponse(BaseModel):
    id: str
    brand_id: str
    name: str
    channel: str
    status: str
    budget: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    goal: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ---- Spend Schemas ----

class SpendCreate(BaseModel):
    campaign_id: str = Field(..., description="UUID of the campaign")
    amount: float = Field(..., ge=0, description="Spend amount in USD")
    date: str = Field(..., description="ISO date string")
    channel: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None


class SpendResponse(BaseModel):
    id: str
    campaign_id: str
    amount_usd: float
    date: str
    channel: Optional[str] = None
    description: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class SpendSummaryItem(BaseModel):
    campaign_id: Optional[str] = None
    channel: Optional[str] = None
    total_spend: float
    entry_count: int


# ---- Conversion Schemas ----

class ConversionCreate(BaseModel):
    campaign_id: str = Field(..., description="UUID of the campaign")
    user_id: Optional[str] = Field(default=None, description="External user identifier")
    revenue: float = Field(..., ge=0, description="Revenue in USD")
    conversion_type: str = Field(default="general", description="e.g. new_customer, returning, general")
    event_type: str = Field(default="purchase", description="e.g. purchase, signup, lead")
    date: Optional[str] = Field(default=None, description="ISO date string for when conversion occurred")


class ConversionResponse(BaseModel):
    id: str
    campaign_id: str
    user_id: Optional[str] = None
    event_type: str
    conversion_type: Optional[str] = None
    revenue_usd: float
    occurred_at: str
    created_at: str

    class Config:
        from_attributes = True


class ConversionSummaryItem(BaseModel):
    campaign_id: Optional[str] = None
    total_revenue: float
    conversion_count: int
    avg_revenue: float


# ---- Attribution Metric Schemas ----

class ROASResponse(BaseModel):
    campaign_id: str
    total_revenue: float
    total_spend: float
    roas: Optional[float] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None


class CACResponse(BaseModel):
    campaign_id: str
    total_spend: float
    new_customers: int
    cac: Optional[float] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None


class LTVResponse(BaseModel):
    campaign_id: str
    total_revenue: float
    unique_customers: int
    ltv: Optional[float] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None


class CampaignPerformance(BaseModel):
    campaign_id: str
    campaign_name: str
    channel: str
    total_spend: float
    total_revenue: float
    roas: Optional[float] = None


class ChannelBreakdown(BaseModel):
    channel: str
    total_spend: float
    total_revenue: float
    roas: Optional[float] = None


class RevenueTrend(BaseModel):
    date: str
    revenue: float


class DashboardResponse(BaseModel):
    total_spend: float
    total_revenue: float
    overall_roas: Optional[float] = None
    total_campaigns: int
    top_campaigns: list[CampaignPerformance]
    channel_breakdown: list[ChannelBreakdown]
    revenue_trends: list[RevenueTrend]


class CampaignReportResponse(BaseModel):
    campaign: CampaignResponse
    total_spend: float
    total_revenue: float
    roas: Optional[float] = None
    cac: Optional[float] = None
    ltv: Optional[float] = None
    new_customers: int
    unique_customers: int
    total_conversions: int
    spend_by_date: list[dict]
    conversions_by_type: list[dict]


# ============================================================================
# Helper functions
# ============================================================================

def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse ISO date string to datetime."""
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid date format: {date_str}. Use ISO format.")


def _parse_uuid(uuid_str: str, field_name: str = "id") -> uuid.UUID:
    """Parse UUID string."""
    try:
        return uuid.UUID(uuid_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail=f"Invalid UUID for {field_name}: {uuid_str}")


def _model_to_campaign_response(c: Campaign) -> CampaignResponse:
    return CampaignResponse(
        id=str(c.id),
        brand_id=str(c.brand_id),
        name=c.name,
        channel=c.channel,
        status=c.status,
        budget=c.budget,
        start_date=c.start_date.isoformat() if c.start_date else None,
        end_date=c.end_date.isoformat() if c.end_date else None,
        goal=c.goal,
        created_at=c.created_at.isoformat() if c.created_at else "",
        updated_at=c.updated_at.isoformat() if c.updated_at else "",
    )


def _model_to_spend_response(s: SpendLog) -> SpendResponse:
    return SpendResponse(
        id=str(s.id),
        campaign_id=str(s.campaign_id),
        amount_usd=s.amount_usd,
        date=s.date.isoformat() if s.date else "",
        channel=s.channel,
        description=s.description,
        created_at=s.created_at.isoformat() if s.created_at else "",
    )


def _model_to_conversion_response(e: ConversionEvent) -> ConversionResponse:
    return ConversionResponse(
        id=str(e.id),
        campaign_id=str(e.campaign_id),
        user_id=e.user_id,
        event_type=e.event_type,
        conversion_type=e.conversion_type,
        revenue_usd=e.revenue_usd,
        occurred_at=e.occurred_at.isoformat() if e.occurred_at else "",
        created_at=e.created_at.isoformat() if e.created_at else "",
    )


def _safe_divide(numerator: float, denominator: float) -> Optional[float]:
    """Safe division, returns None on zero denominator."""
    if denominator == 0:
        return None
    return round(numerator / denominator, 4)


# ============================================================================
# Routers
# ============================================================================

campaigns_router = APIRouter(prefix="/campaigns", tags=["Campaigns"])
spend_router = APIRouter(prefix="/spend", tags=["Spend Tracking"])
conversions_router = APIRouter(prefix="/conversions", tags=["Conversions"])
attribution_router = APIRouter(prefix="/attribution", tags=["Attribution Metrics"])


# ============================================================================
# Campaign CRUD Endpoints
# ============================================================================

@campaigns_router.post("/", response_model=CampaignResponse, status_code=201)
async def create_campaign(payload: CampaignCreate, db: AsyncSession = Depends(get_db)):
    """Create a new marketing campaign."""
    brand_uuid = _parse_uuid(payload.brand_id, "brand_id")
    start_dt = _parse_date(payload.start_date)
    end_dt = _parse_date(payload.end_date)

    campaign = Campaign(
        brand_id=brand_uuid,
        name=payload.name,
        channel=payload.channel,
        status=payload.status,
        budget=payload.budget,
        start_date=start_dt,
        end_date=end_dt,
        goal=payload.goal,
    )
    db.add(campaign)
    await db.flush()
    await db.refresh(campaign)
    logger.info("Created campaign %s: %s", campaign.id, campaign.name)
    return _model_to_campaign_response(campaign)


@campaigns_router.get("/", response_model=list[CampaignResponse])
async def list_campaigns(
    brand_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None, description="Filter campaigns starting after this date"),
    end_date: Optional[str] = Query(default=None, description="Filter campaigns ending before this date"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List all campaigns with optional filtering."""
    query = select(Campaign)
    conditions = []

    if brand_id:
        conditions.append(Campaign.brand_id == _parse_uuid(brand_id, "brand_id"))
    if status:
        conditions.append(Campaign.status == status)
    if start_date:
        conditions.append(Campaign.start_date >= _parse_date(start_date))
    if end_date:
        conditions.append(Campaign.end_date <= _parse_date(end_date))

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(Campaign.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    campaigns = result.scalars().all()
    return [_model_to_campaign_response(c) for c in campaigns]


@campaigns_router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single campaign by ID."""
    cid = _parse_uuid(campaign_id, "campaign_id")
    result = await db.execute(select(Campaign).where(Campaign.id == cid))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")
    return _model_to_campaign_response(campaign)


@campaigns_router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: str, payload: CampaignUpdate, db: AsyncSession = Depends(get_db)):
    """Update an existing campaign."""
    cid = _parse_uuid(campaign_id, "campaign_id")
    result = await db.execute(select(Campaign).where(Campaign.id == cid))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ("start_date", "end_date") and value is not None:
            value = _parse_date(value)
        setattr(campaign, field, value)

    await db.flush()
    await db.refresh(campaign)
    logger.info("Updated campaign %s", campaign.id)
    return _model_to_campaign_response(campaign)


@campaigns_router.delete("/{campaign_id}", status_code=200)
async def delete_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a campaign and all related spend/conversion data."""
    cid = _parse_uuid(campaign_id, "campaign_id")
    result = await db.execute(select(Campaign).where(Campaign.id == cid))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")

    await db.delete(campaign)
    await db.flush()
    logger.info("Deleted campaign %s", cid)
    return {"detail": f"Campaign {campaign_id} deleted successfully"}


# ============================================================================
# Spend Tracking Endpoints
# ============================================================================

@spend_router.post("/", response_model=SpendResponse, status_code=201)
async def create_spend(payload: SpendCreate, db: AsyncSession = Depends(get_db)):
    """Log a spend entry for a campaign."""
    cid = _parse_uuid(payload.campaign_id, "campaign_id")
    spend_date = _parse_date(payload.date)
    if not spend_date:
        raise HTTPException(status_code=400, detail="date is required")

    # Verify campaign exists
    result = await db.execute(select(Campaign).where(Campaign.id == cid))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Campaign {payload.campaign_id} not found")

    spend = SpendLog(
        campaign_id=cid,
        amount_usd=payload.amount,
        date=spend_date,
        channel=payload.channel,
        description=payload.description,
    )
    db.add(spend)
    await db.flush()
    await db.refresh(spend)
    logger.info("Created spend entry %s for campaign %s: $%.2f", spend.id, cid, payload.amount)
    return _model_to_spend_response(spend)


@spend_router.get("/campaign/{campaign_id}", response_model=list[SpendResponse])
async def get_campaign_spend(
    campaign_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get all spend entries for a campaign."""
    cid = _parse_uuid(campaign_id, "campaign_id")
    query = select(SpendLog).where(SpendLog.campaign_id == cid)

    if start_date:
        query = query.where(SpendLog.date >= _parse_date(start_date))
    if end_date:
        query = query.where(SpendLog.date <= _parse_date(end_date))

    query = query.order_by(SpendLog.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return [_model_to_spend_response(s) for s in result.scalars().all()]


@spend_router.get("/summary", response_model=list[SpendSummaryItem])
async def get_spend_summary(
    campaign_id: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    group_by: str = Query(default="campaign", pattern="^(campaign|channel)$"),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate spend summary grouped by campaign or channel."""
    if group_by == "campaign":
        group_col = SpendLog.campaign_id
    else:
        group_col = SpendLog.channel

    query = select(
        group_col,
        sa_func.sum(SpendLog.amount_usd).label("total_spend"),
        sa_func.count(SpendLog.id).label("entry_count"),
    )

    conditions = []
    if campaign_id:
        conditions.append(SpendLog.campaign_id == _parse_uuid(campaign_id, "campaign_id"))
    if channel:
        conditions.append(SpendLog.channel == channel)
    if start_date:
        conditions.append(SpendLog.date >= _parse_date(start_date))
    if end_date:
        conditions.append(SpendLog.date <= _parse_date(end_date))

    if conditions:
        query = query.where(and_(*conditions))

    query = query.group_by(group_col)
    result = await db.execute(query)
    rows = result.all()

    summaries = []
    for row in rows:
        item = SpendSummaryItem(
            campaign_id=str(row[0]) if group_by == "campaign" else None,
            channel=row[0] if group_by == "channel" else None,
            total_spend=float(row[1] or 0),
            entry_count=int(row[2] or 0),
        )
        summaries.append(item)
    return summaries


# ============================================================================
# Conversion Event Endpoints
# ============================================================================

@conversions_router.post("/", response_model=ConversionResponse, status_code=201)
async def create_conversion(payload: ConversionCreate, db: AsyncSession = Depends(get_db)):
    """Record a conversion event for a campaign."""
    cid = _parse_uuid(payload.campaign_id, "campaign_id")

    # Verify campaign exists
    result = await db.execute(select(Campaign).where(Campaign.id == cid))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"Campaign {payload.campaign_id} not found")

    occurred_at = _parse_date(payload.date) if payload.date else datetime.utcnow()

    event = ConversionEvent(
        campaign_id=cid,
        user_id=payload.user_id,
        event_type=payload.event_type,
        conversion_type=payload.conversion_type,
        revenue_usd=payload.revenue,
        occurred_at=occurred_at,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    logger.info("Recorded conversion %s for campaign %s: $%.2f", event.id, cid, payload.revenue)
    return _model_to_conversion_response(event)


@conversions_router.get("/campaign/{campaign_id}", response_model=list[ConversionResponse])
async def get_campaign_conversions(
    campaign_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    conversion_type: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get conversions for a campaign."""
    cid = _parse_uuid(campaign_id, "campaign_id")
    query = select(ConversionEvent).where(ConversionEvent.campaign_id == cid)

    if start_date:
        query = query.where(ConversionEvent.occurred_at >= _parse_date(start_date))
    if end_date:
        query = query.where(ConversionEvent.occurred_at <= _parse_date(end_date))
    if conversion_type:
        query = query.where(ConversionEvent.conversion_type == conversion_type)

    query = query.order_by(ConversionEvent.occurred_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return [_model_to_conversion_response(e) for e in result.scalars().all()]


@conversions_router.get("/summary", response_model=list[ConversionSummaryItem])
async def get_conversions_summary(
    campaign_id: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate conversion summary grouped by campaign."""
    query = select(
        ConversionEvent.campaign_id,
        sa_func.sum(ConversionEvent.revenue_usd).label("total_revenue"),
        sa_func.count(ConversionEvent.id).label("conversion_count"),
        sa_func.avg(ConversionEvent.revenue_usd).label("avg_revenue"),
    )

    conditions = []
    if campaign_id:
        conditions.append(ConversionEvent.campaign_id == _parse_uuid(campaign_id, "campaign_id"))
    if start_date:
        conditions.append(ConversionEvent.occurred_at >= _parse_date(start_date))
    if end_date:
        conditions.append(ConversionEvent.occurred_at <= _parse_date(end_date))

    if conditions:
        query = query.where(and_(*conditions))

    query = query.group_by(ConversionEvent.campaign_id)
    result = await db.execute(query)
    rows = result.all()

    return [
        ConversionSummaryItem(
            campaign_id=str(row[0]),
            total_revenue=float(row[1] or 0),
            conversion_count=int(row[2] or 0),
            avg_revenue=round(float(row[3] or 0), 4),
        )
        for row in rows
    ]


# ============================================================================
# Attribution Metric Endpoints
# ============================================================================

async def _get_campaign_spend_total(
    db: AsyncSession, campaign_id: uuid.UUID,
    start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
) -> float:
    """Get total spend for a campaign within an optional date range."""
    query = select(sa_func.coalesce(sa_func.sum(SpendLog.amount_usd), 0.0)).where(
        SpendLog.campaign_id == campaign_id
    )
    if start_date:
        query = query.where(SpendLog.date >= start_date)
    if end_date:
        query = query.where(SpendLog.date <= end_date)
    result = await db.execute(query)
    return float(result.scalar() or 0.0)


async def _get_campaign_revenue_total(
    db: AsyncSession, campaign_id: uuid.UUID,
    start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
) -> float:
    """Get total revenue for a campaign within an optional date range."""
    query = select(sa_func.coalesce(sa_func.sum(ConversionEvent.revenue_usd), 0.0)).where(
        ConversionEvent.campaign_id == campaign_id
    )
    if start_date:
        query = query.where(ConversionEvent.occurred_at >= start_date)
    if end_date:
        query = query.where(ConversionEvent.occurred_at <= end_date)
    result = await db.execute(query)
    return float(result.scalar() or 0.0)


async def _get_new_customer_count(
    db: AsyncSession, campaign_id: uuid.UUID,
    start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
) -> int:
    """Count new customer conversions for a campaign."""
    query = select(sa_func.count(ConversionEvent.id)).where(
        and_(
            ConversionEvent.campaign_id == campaign_id,
            ConversionEvent.conversion_type == "new_customer",
        )
    )
    if start_date:
        query = query.where(ConversionEvent.occurred_at >= start_date)
    if end_date:
        query = query.where(ConversionEvent.occurred_at <= end_date)
    result = await db.execute(query)
    return int(result.scalar() or 0)


async def _get_unique_customers(
    db: AsyncSession, campaign_id: uuid.UUID,
    start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
) -> int:
    """Count unique customers for a campaign."""
    query = select(sa_func.count(sa_func.distinct(ConversionEvent.user_id))).where(
        and_(
            ConversionEvent.campaign_id == campaign_id,
            ConversionEvent.user_id.isnot(None),
        )
    )
    if start_date:
        query = query.where(ConversionEvent.occurred_at >= start_date)
    if end_date:
        query = query.where(ConversionEvent.occurred_at <= end_date)
    result = await db.execute(query)
    return int(result.scalar() or 0)


@attribution_router.get("/roas/{campaign_id}", response_model=ROASResponse)
async def get_roas(
    campaign_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Calculate Return on Ad Spend (ROAS) for a campaign.

    ROAS = Total Revenue / Total Spend
    """
    cid = _parse_uuid(campaign_id, "campaign_id")
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)

    total_spend = await _get_campaign_spend_total(db, cid, sd, ed)
    total_revenue = await _get_campaign_revenue_total(db, cid, sd, ed)
    roas = _safe_divide(total_revenue, total_spend)

    return ROASResponse(
        campaign_id=campaign_id,
        total_revenue=round(total_revenue, 2),
        total_spend=round(total_spend, 2),
        roas=roas,
        period_start=start_date,
        period_end=end_date,
    )


@attribution_router.get("/cac/{campaign_id}", response_model=CACResponse)
async def get_cac(
    campaign_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Calculate Customer Acquisition Cost (CAC) for a campaign.

    CAC = Total Spend / Number of New Customer Conversions
    """
    cid = _parse_uuid(campaign_id, "campaign_id")
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)

    total_spend = await _get_campaign_spend_total(db, cid, sd, ed)
    new_customers = await _get_new_customer_count(db, cid, sd, ed)
    cac = _safe_divide(total_spend, new_customers)

    return CACResponse(
        campaign_id=campaign_id,
        total_spend=round(total_spend, 2),
        new_customers=new_customers,
        cac=cac,
        period_start=start_date,
        period_end=end_date,
    )


@attribution_router.get("/ltv/{campaign_id}", response_model=LTVResponse)
async def get_ltv(
    campaign_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Calculate Lifetime Value (LTV) for a campaign.

    LTV = Total Revenue / Unique Customers
    """
    cid = _parse_uuid(campaign_id, "campaign_id")
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)

    total_revenue = await _get_campaign_revenue_total(db, cid, sd, ed)
    unique_customers = await _get_unique_customers(db, cid, sd, ed)
    ltv = _safe_divide(total_revenue, unique_customers)

    return LTVResponse(
        campaign_id=campaign_id,
        total_revenue=round(total_revenue, 2),
        unique_customers=unique_customers,
        ltv=ltv,
        period_start=start_date,
        period_end=end_date,
    )


@attribution_router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive attribution dashboard data.

    Returns:
    - Total spend across all campaigns
    - Total revenue
    - Overall ROAS
    - Top performing campaigns (by ROAS)
    - Spend by channel breakdown
    - Revenue trends over time
    """
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)

    # ---- Total spend ----
    spend_query = select(sa_func.coalesce(sa_func.sum(SpendLog.amount_usd), 0.0))
    if sd:
        spend_query = spend_query.where(SpendLog.date >= sd)
    if ed:
        spend_query = spend_query.where(SpendLog.date <= ed)
    total_spend = float((await db.execute(spend_query)).scalar() or 0.0)

    # ---- Total revenue ----
    rev_query = select(sa_func.coalesce(sa_func.sum(ConversionEvent.revenue_usd), 0.0))
    if sd:
        rev_query = rev_query.where(ConversionEvent.occurred_at >= sd)
    if ed:
        rev_query = rev_query.where(ConversionEvent.occurred_at <= ed)
    total_revenue = float((await db.execute(rev_query)).scalar() or 0.0)

    overall_roas = _safe_divide(total_revenue, total_spend)

    # ---- Total campaigns ----
    campaign_count = int(
        (await db.execute(select(sa_func.count(Campaign.id)))).scalar() or 0
    )

    # ---- Top performing campaigns (by revenue) ----
    top_query = (
        select(
            Campaign.id,
            Campaign.name,
            Campaign.channel,
            sa_func.coalesce(sa_func.sum(SpendLog.amount_usd), 0.0).label("total_spend"),
            sa_func.coalesce(
                select(sa_func.sum(ConversionEvent.revenue_usd))
                .where(ConversionEvent.campaign_id == Campaign.id)
                .correlate(Campaign)
                .scalar_subquery(),
                0.0,
            ).label("total_revenue"),
        )
        .outerjoin(SpendLog, SpendLog.campaign_id == Campaign.id)
        .group_by(Campaign.id, Campaign.name, Campaign.channel)
        .order_by(sa_func.coalesce(
            select(sa_func.sum(ConversionEvent.revenue_usd))
            .where(ConversionEvent.campaign_id == Campaign.id)
            .correlate(Campaign)
            .scalar_subquery(),
            0.0,
        ).desc())
        .limit(10)
    )
    top_result = await db.execute(top_query)
    top_campaigns = []
    for row in top_result.all():
        spend_val = float(row[3] or 0)
        rev_val = float(row[4] or 0)
        top_campaigns.append(CampaignPerformance(
            campaign_id=str(row[0]),
            campaign_name=row[1],
            channel=row[2],
            total_spend=round(spend_val, 2),
            total_revenue=round(rev_val, 2),
            roas=_safe_divide(rev_val, spend_val),
        ))

    # ---- Channel breakdown ----
    channel_query = (
        select(
            Campaign.channel,
            sa_func.coalesce(sa_func.sum(SpendLog.amount_usd), 0.0).label("total_spend"),
        )
        .outerjoin(SpendLog, SpendLog.campaign_id == Campaign.id)
        .group_by(Campaign.channel)
    )
    channel_result = await db.execute(channel_query)

    channel_breakdown = []
    for row in channel_result.all():
        ch = row[0]
        ch_spend = float(row[1] or 0)
        # Get revenue for this channel
        ch_rev_q = (
            select(sa_func.coalesce(sa_func.sum(ConversionEvent.revenue_usd), 0.0))
            .join(Campaign, ConversionEvent.campaign_id == Campaign.id)
            .where(Campaign.channel == ch)
        )
        ch_revenue = float((await db.execute(ch_rev_q)).scalar() or 0.0)
        channel_breakdown.append(ChannelBreakdown(
            channel=ch,
            total_spend=round(ch_spend, 2),
            total_revenue=round(ch_revenue, 2),
            roas=_safe_divide(ch_revenue, ch_spend),
        ))

    # ---- Revenue trends (daily) ----
    # Use func.date() which works in both PostgreSQL and SQLite
    day_expr = sa_func.date(ConversionEvent.occurred_at)
    trend_query = select(
        day_expr.label("day"),
        sa_func.sum(ConversionEvent.revenue_usd).label("revenue"),
    )
    if sd:
        trend_query = trend_query.where(ConversionEvent.occurred_at >= sd)
    if ed:
        trend_query = trend_query.where(ConversionEvent.occurred_at <= ed)
    trend_query = trend_query.group_by(day_expr).order_by(day_expr)
    trend_result = await db.execute(trend_query)

    revenue_trends = [
        RevenueTrend(
            date=str(row[0]) if row[0] else "",
            revenue=round(float(row[1] or 0), 2),
        )
        for row in trend_result.all()
    ]

    return DashboardResponse(
        total_spend=round(total_spend, 2),
        total_revenue=round(total_revenue, 2),
        overall_roas=overall_roas,
        total_campaigns=campaign_count,
        top_campaigns=top_campaigns,
        channel_breakdown=channel_breakdown,
        revenue_trends=revenue_trends,
    )


@attribution_router.get("/report/{campaign_id}", response_model=CampaignReportResponse)
async def get_campaign_report(
    campaign_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Get a detailed attribution report for a specific campaign."""
    cid = _parse_uuid(campaign_id, "campaign_id")
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)

    # Fetch campaign
    result = await db.execute(select(Campaign).where(Campaign.id == cid))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")

    total_spend = await _get_campaign_spend_total(db, cid, sd, ed)
    total_revenue = await _get_campaign_revenue_total(db, cid, sd, ed)
    new_customers = await _get_new_customer_count(db, cid, sd, ed)
    unique_customers = await _get_unique_customers(db, cid, sd, ed)

    # Total conversions count
    conv_count_q = select(sa_func.count(ConversionEvent.id)).where(
        ConversionEvent.campaign_id == cid
    )
    if sd:
        conv_count_q = conv_count_q.where(ConversionEvent.occurred_at >= sd)
    if ed:
        conv_count_q = conv_count_q.where(ConversionEvent.occurred_at <= ed)
    total_conversions = int((await db.execute(conv_count_q)).scalar() or 0)

    # Spend by date
    spend_day_expr = sa_func.date(SpendLog.date)
    spend_by_date_q = (
        select(
            spend_day_expr.label("day"),
            sa_func.sum(SpendLog.amount_usd).label("total"),
        )
        .where(SpendLog.campaign_id == cid)
        .group_by(spend_day_expr)
        .order_by(spend_day_expr)
    )
    if sd:
        spend_by_date_q = spend_by_date_q.where(SpendLog.date >= sd)
    if ed:
        spend_by_date_q = spend_by_date_q.where(SpendLog.date <= ed)
    spend_rows = (await db.execute(spend_by_date_q)).all()
    spend_by_date = [
        {"date": str(row[0]) if row[0] else "", "amount": round(float(row[1] or 0), 2)}
        for row in spend_rows
    ]

    # Conversions by type
    conv_by_type_q = (
        select(
            ConversionEvent.conversion_type,
            sa_func.count(ConversionEvent.id).label("count"),
            sa_func.sum(ConversionEvent.revenue_usd).label("revenue"),
        )
        .where(ConversionEvent.campaign_id == cid)
        .group_by(ConversionEvent.conversion_type)
    )
    if sd:
        conv_by_type_q = conv_by_type_q.where(ConversionEvent.occurred_at >= sd)
    if ed:
        conv_by_type_q = conv_by_type_q.where(ConversionEvent.occurred_at <= ed)
    conv_rows = (await db.execute(conv_by_type_q)).all()
    conversions_by_type = [
        {
            "type": row[0] or "unknown",
            "count": int(row[1] or 0),
            "revenue": round(float(row[2] or 0), 2),
        }
        for row in conv_rows
    ]

    return CampaignReportResponse(
        campaign=_model_to_campaign_response(campaign),
        total_spend=round(total_spend, 2),
        total_revenue=round(total_revenue, 2),
        roas=_safe_divide(total_revenue, total_spend),
        cac=_safe_divide(total_spend, new_customers),
        ltv=_safe_divide(total_revenue, unique_customers),
        new_customers=new_customers,
        unique_customers=unique_customers,
        total_conversions=total_conversions,
        spend_by_date=spend_by_date,
        conversions_by_type=conversions_by_type,
    )


# ============================================================================
# Combined Router for main.py registration
# ============================================================================
router = APIRouter()
router.include_router(campaigns_router)
router.include_router(spend_router)
router.include_router(conversions_router)
router.include_router(attribution_router)
