"""Tests for Module C — Attribution Engine API endpoints.

Uses an in-memory SQLite database to verify all CRUD operations,
spend tracking, conversion events, and attribution metric calculations.
"""
from __future__ import annotations

import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from db.database import Base, get_db
from db.models import Campaign, SpendLog, ConversionEvent, BrandProfile, User

# ---------------------------------------------------------------------------
# We need to patch the main app to use a test DB
# ---------------------------------------------------------------------------
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Create test engine with SQLite
TEST_DB_URL = "sqlite+aiosqlite:///./test_attribution.db"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    """Provide a test DB session."""
    async with TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    """Provide an async test client with DB override."""
    from main import app
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seed_brand(db_session: AsyncSession):
    """Create a test user and brand profile, return brand_id."""
    user = User(
        email="test@example.com",
        full_name="Test User",
        hashed_password="fakehash",
    )
    db_session.add(user)
    await db_session.flush()

    brand = BrandProfile(
        owner_id=user.id,
        name="Test Brand",
        vertical="SaaS",
    )
    db_session.add(brand)
    await db_session.flush()
    await db_session.commit()
    return str(brand.id)


@pytest_asyncio.fixture
async def seed_campaign(client: AsyncClient, seed_brand: str):
    """Create a test campaign and return its ID."""
    resp = await client.post("/api/v1/campaigns/", json={
        "name": "Summer Sale",
        "brand_id": seed_brand,
        "channel": "meta",
        "budget": 5000.0,
        "start_date": "2026-01-01",
        "end_date": "2026-06-30",
    })
    assert resp.status_code == 201
    return resp.json()["id"]


# ============================================================================
# Campaign CRUD Tests
# ============================================================================

class TestCampaignCRUD:
    @pytest.mark.asyncio
    async def test_create_campaign(self, client: AsyncClient, seed_brand: str):
        resp = await client.post("/api/v1/campaigns/", json={
            "name": "Q1 Push",
            "brand_id": seed_brand,
            "channel": "google",
            "budget": 10000,
            "start_date": "2026-01-01",
            "end_date": "2026-03-31",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Q1 Push"
        assert data["channel"] == "google"
        assert data["status"] == "draft"
        assert data["budget"] == 10000.0
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_campaign_invalid_brand(self, client: AsyncClient):
        resp = await client.post("/api/v1/campaigns/", json={
            "name": "Bad Campaign",
            "brand_id": "not-a-uuid",
            "channel": "meta",
        })
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_list_campaigns(self, client: AsyncClient, seed_brand: str):
        # Create two campaigns
        await client.post("/api/v1/campaigns/", json={
            "name": "Camp A", "brand_id": seed_brand, "channel": "meta",
        })
        await client.post("/api/v1/campaigns/", json={
            "name": "Camp B", "brand_id": seed_brand, "channel": "google",
        })
        resp = await client.get("/api/v1/campaigns/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2

    @pytest.mark.asyncio
    async def test_list_campaigns_filter_by_brand(self, client: AsyncClient, seed_brand: str):
        await client.post("/api/v1/campaigns/", json={
            "name": "Filtered", "brand_id": seed_brand, "channel": "email",
        })
        resp = await client.get(f"/api/v1/campaigns/?brand_id={seed_brand}")
        assert resp.status_code == 200
        assert all(c["brand_id"] == seed_brand for c in resp.json())

    @pytest.mark.asyncio
    async def test_get_campaign(self, client: AsyncClient, seed_campaign: str):
        resp = await client.get(f"/api/v1/campaigns/{seed_campaign}")
        assert resp.status_code == 200
        assert resp.json()["id"] == seed_campaign

    @pytest.mark.asyncio
    async def test_get_campaign_not_found(self, client: AsyncClient):
        fake_id = str(uuid.uuid4())
        resp = await client.get(f"/api/v1/campaigns/{fake_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_campaign(self, client: AsyncClient, seed_campaign: str):
        resp = await client.put(f"/api/v1/campaigns/{seed_campaign}", json={
            "name": "Updated Summer Sale",
            "status": "active",
            "budget": 7500.0,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated Summer Sale"
        assert data["status"] == "active"
        assert data["budget"] == 7500.0

    @pytest.mark.asyncio
    async def test_delete_campaign(self, client: AsyncClient, seed_campaign: str):
        resp = await client.delete(f"/api/v1/campaigns/{seed_campaign}")
        assert resp.status_code == 200
        # Verify deleted
        resp2 = await client.get(f"/api/v1/campaigns/{seed_campaign}")
        assert resp2.status_code == 404


# ============================================================================
# Spend Tracking Tests
# ============================================================================

class TestSpendTracking:
    @pytest.mark.asyncio
    async def test_create_spend(self, client: AsyncClient, seed_campaign: str):
        resp = await client.post("/api/v1/spend/", json={
            "campaign_id": seed_campaign,
            "amount": 250.50,
            "date": "2026-02-15",
            "channel": "meta",
            "description": "Valentine's Day ad push",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount_usd"] == 250.50
        assert data["channel"] == "meta"

    @pytest.mark.asyncio
    async def test_create_spend_invalid_campaign(self, client: AsyncClient):
        fake_id = str(uuid.uuid4())
        resp = await client.post("/api/v1/spend/", json={
            "campaign_id": fake_id,
            "amount": 100.0,
            "date": "2026-02-15",
        })
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_campaign_spend(self, client: AsyncClient, seed_campaign: str):
        # Create multiple spend entries
        for i in range(3):
            await client.post("/api/v1/spend/", json={
                "campaign_id": seed_campaign,
                "amount": 100.0 * (i + 1),
                "date": f"2026-03-{10 + i:02d}",
            })
        resp = await client.get(f"/api/v1/spend/campaign/{seed_campaign}")
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    @pytest.mark.asyncio
    async def test_spend_summary_by_campaign(self, client: AsyncClient, seed_campaign: str):
        await client.post("/api/v1/spend/", json={
            "campaign_id": seed_campaign, "amount": 500.0, "date": "2026-01-15",
        })
        await client.post("/api/v1/spend/", json={
            "campaign_id": seed_campaign, "amount": 300.0, "date": "2026-01-20",
        })
        resp = await client.get("/api/v1/spend/summary?group_by=campaign")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        total = sum(item["total_spend"] for item in data)
        assert total >= 800.0


# ============================================================================
# Conversion Event Tests
# ============================================================================

class TestConversions:
    @pytest.mark.asyncio
    async def test_create_conversion(self, client: AsyncClient, seed_campaign: str):
        resp = await client.post("/api/v1/conversions/", json={
            "campaign_id": seed_campaign,
            "user_id": "user-001",
            "revenue": 149.99,
            "conversion_type": "new_customer",
            "event_type": "purchase",
            "date": "2026-02-20",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["revenue_usd"] == 149.99
        assert data["conversion_type"] == "new_customer"
        assert data["user_id"] == "user-001"

    @pytest.mark.asyncio
    async def test_create_conversion_invalid_campaign(self, client: AsyncClient):
        fake_id = str(uuid.uuid4())
        resp = await client.post("/api/v1/conversions/", json={
            "campaign_id": fake_id,
            "revenue": 50.0,
            "conversion_type": "general",
            "event_type": "lead",
        })
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_campaign_conversions(self, client: AsyncClient, seed_campaign: str):
        for i in range(4):
            await client.post("/api/v1/conversions/", json={
                "campaign_id": seed_campaign,
                "user_id": f"user-{i:03d}",
                "revenue": 50.0 * (i + 1),
                "conversion_type": "new_customer" if i % 2 == 0 else "returning",
                "event_type": "purchase",
                "date": f"2026-03-{10 + i:02d}",
            })
        resp = await client.get(f"/api/v1/conversions/campaign/{seed_campaign}")
        assert resp.status_code == 200
        assert len(resp.json()) == 4

    @pytest.mark.asyncio
    async def test_conversions_summary(self, client: AsyncClient, seed_campaign: str):
        await client.post("/api/v1/conversions/", json={
            "campaign_id": seed_campaign, "revenue": 100.0,
            "conversion_type": "new_customer", "event_type": "purchase",
        })
        await client.post("/api/v1/conversions/", json={
            "campaign_id": seed_campaign, "revenue": 200.0,
            "conversion_type": "returning", "event_type": "purchase",
        })
        resp = await client.get("/api/v1/conversions/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        entry = [d for d in data if d["campaign_id"] == seed_campaign][0]
        assert entry["total_revenue"] == 300.0
        assert entry["conversion_count"] == 2


# ============================================================================
# Attribution Metrics Tests
# ============================================================================

class TestAttributionMetrics:
    """Tests for ROAS, CAC, LTV, dashboard, and report endpoints."""

    async def _seed_spend_and_conversions(self, client, campaign_id):
        """Helper to seed spend and conversion data for metric tests."""
        # Spend: total $1000
        for i in range(4):
            await client.post("/api/v1/spend/", json={
                "campaign_id": campaign_id,
                "amount": 250.0,
                "date": f"2026-02-{10 + i:02d}",
                "channel": "meta",
            })
        # Conversions: 3 new customers + 2 returning, total revenue $750
        for i in range(3):
            await client.post("/api/v1/conversions/", json={
                "campaign_id": campaign_id,
                "user_id": f"new-user-{i}",
                "revenue": 150.0,
                "conversion_type": "new_customer",
                "event_type": "purchase",
                "date": f"2026-02-{15 + i:02d}",
            })
        for i in range(2):
            await client.post("/api/v1/conversions/", json={
                "campaign_id": campaign_id,
                "user_id": f"ret-user-{i}",
                "revenue": 75.0,
                "conversion_type": "returning",
                "event_type": "purchase",
                "date": f"2026-02-{20 + i:02d}",
            })

    @pytest.mark.asyncio
    async def test_roas_calculation(self, client: AsyncClient, seed_campaign: str):
        await self._seed_spend_and_conversions(client, seed_campaign)
        resp = await client.get(f"/api/v1/attribution/roas/{seed_campaign}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_spend"] == 1000.0
        assert data["total_revenue"] == 600.0  # 3*150 + 2*75 = 450+150=600
        # ROAS = 600/1000 = 0.6
        assert data["roas"] == 0.6

    @pytest.mark.asyncio
    async def test_roas_no_spend(self, client: AsyncClient, seed_campaign: str):
        """ROAS should be None when there's no spend (division by zero)."""
        resp = await client.get(f"/api/v1/attribution/roas/{seed_campaign}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_spend"] == 0.0
        assert data["roas"] is None

    @pytest.mark.asyncio
    async def test_cac_calculation(self, client: AsyncClient, seed_campaign: str):
        await self._seed_spend_and_conversions(client, seed_campaign)
        resp = await client.get(f"/api/v1/attribution/cac/{seed_campaign}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_spend"] == 1000.0
        assert data["new_customers"] == 3
        # CAC = 1000/3 ≈ 333.3333
        assert data["cac"] == pytest.approx(333.3333, abs=0.001)

    @pytest.mark.asyncio
    async def test_cac_no_customers(self, client: AsyncClient, seed_campaign: str):
        """CAC should be None when there are no new customers."""
        await client.post("/api/v1/spend/", json={
            "campaign_id": seed_campaign, "amount": 500.0, "date": "2026-02-01",
        })
        resp = await client.get(f"/api/v1/attribution/cac/{seed_campaign}")
        assert resp.status_code == 200
        assert resp.json()["cac"] is None

    @pytest.mark.asyncio
    async def test_ltv_calculation(self, client: AsyncClient, seed_campaign: str):
        await self._seed_spend_and_conversions(client, seed_campaign)
        resp = await client.get(f"/api/v1/attribution/ltv/{seed_campaign}")
        assert resp.status_code == 200
        data = resp.json()
        # 5 unique customers, total revenue = 600
        assert data["unique_customers"] == 5
        # LTV = 600/5 = 120.0
        assert data["ltv"] == 120.0

    @pytest.mark.asyncio
    async def test_ltv_no_customers(self, client: AsyncClient, seed_campaign: str):
        """LTV should be None when there are no customers."""
        resp = await client.get(f"/api/v1/attribution/ltv/{seed_campaign}")
        assert resp.status_code == 200
        assert resp.json()["ltv"] is None

    @pytest.mark.asyncio
    async def test_dashboard(self, client: AsyncClient, seed_campaign: str):
        await self._seed_spend_and_conversions(client, seed_campaign)
        resp = await client.get("/api/v1/attribution/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_spend"] >= 1000.0
        assert data["total_revenue"] >= 600.0
        assert data["total_campaigns"] >= 1
        assert isinstance(data["top_campaigns"], list)
        assert isinstance(data["channel_breakdown"], list)
        assert isinstance(data["revenue_trends"], list)
        # Overall ROAS should be computed
        if data["total_spend"] > 0:
            expected_roas = round(data["total_revenue"] / data["total_spend"], 4)
            assert data["overall_roas"] == expected_roas

    @pytest.mark.asyncio
    async def test_campaign_report(self, client: AsyncClient, seed_campaign: str):
        await self._seed_spend_and_conversions(client, seed_campaign)
        resp = await client.get(f"/api/v1/attribution/report/{seed_campaign}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["campaign"]["id"] == seed_campaign
        assert data["total_spend"] == 1000.0
        assert data["total_revenue"] == 600.0
        assert data["roas"] == 0.6
        assert data["new_customers"] == 3
        assert data["unique_customers"] == 5
        assert data["total_conversions"] == 5
        assert isinstance(data["spend_by_date"], list)
        assert isinstance(data["conversions_by_type"], list)

    @pytest.mark.asyncio
    async def test_campaign_report_not_found(self, client: AsyncClient):
        fake_id = str(uuid.uuid4())
        resp = await client.get(f"/api/v1/attribution/report/{fake_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_roas_with_date_range(self, client: AsyncClient, seed_campaign: str):
        """Test ROAS with date range filtering."""
        await self._seed_spend_and_conversions(client, seed_campaign)
        resp = await client.get(
            f"/api/v1/attribution/roas/{seed_campaign}?start_date=2026-02-10&end_date=2026-02-14"
        )
        assert resp.status_code == 200
        data = resp.json()
        # Only spend from Feb 10-13 within range, no conversions in that range
        assert data["period_start"] == "2026-02-10"
        assert data["period_end"] == "2026-02-14"


# ============================================================================
# Edge Cases & Validation Tests
# ============================================================================

class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_invalid_uuid_format(self, client: AsyncClient):
        resp = await client.get("/api/v1/campaigns/not-a-valid-uuid")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_invalid_date_format(self, client: AsyncClient, seed_campaign: str):
        resp = await client.get(f"/api/v1/attribution/roas/{seed_campaign}?start_date=invalid")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_pagination(self, client: AsyncClient, seed_brand: str):
        # Create 5 campaigns
        for i in range(5):
            await client.post("/api/v1/campaigns/", json={
                "name": f"Camp {i}", "brand_id": seed_brand, "channel": "meta",
            })
        # Request with limit=2
        resp = await client.get("/api/v1/campaigns/?limit=2")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

        # Request with skip
        resp2 = await client.get("/api/v1/campaigns/?skip=3&limit=10")
        assert resp2.status_code == 200
        assert len(resp2.json()) == 2  # 5 - 3 = 2

    @pytest.mark.asyncio
    async def test_negative_amount_rejected(self, client: AsyncClient, seed_campaign: str):
        resp = await client.post("/api/v1/spend/", json={
            "campaign_id": seed_campaign,
            "amount": -100.0,
            "date": "2026-01-01",
        })
        assert resp.status_code == 422  # Pydantic validation error
