"""Facility-scoped Kisumu synthetic captures, isolated from legacy storage."""

from hashlib import sha256
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from dawa_api.auth.service import Principal
from dawa_api.capture.extraction import (
    BinCardFields,
    DailyLimitExceeded,
    ExtractionCoordinator,
    ProviderUnavailable,
)
from dawa_api.capture.images import ImageValidationError, validate_image
from dawa_api.capture.repository import PostgresExtractionStore
from dawa_api.capture.schemas import CaptureConfirmation, CaptureRead
from dawa_api.ingestion.county_repository import CountySnapshotRepository
from dawa_api.scenarios.router import current_principal, session_for_request
from dawa_api.storage.models import CountyCapture

router = APIRouter(
    prefix="/counties/{county_code}/facilities/{facility_id}/captures", tags=["capture"]
)


async def scope(session: AsyncSession, principal: Principal, county: str, facility: str) -> None:
    if (
        principal.country_code != "KE"
        or principal.county_code != county
        or county != "042"
        or principal.role != "facility"
        or principal.facility_id != facility
    ):
        raise HTTPException(status_code=403, detail="Facility scope required")
    await session.execute(select(func.set_config("app.country_code", "KE", True)))
    await session.execute(select(func.set_config("app.county_code", county, True)))


@router.post("", response_model=CaptureRead, status_code=201)
async def create_county_capture(
    county_code: str,
    facility_id: str,
    request: Request,
    response: Response,
    principal: Annotated[Principal, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    seed: int,
    synthetic_attested: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
    key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=128)],
) -> CaptureRead:
    await scope(session, principal, county_code, facility_id)
    if synthetic_attested != "true":
        raise HTTPException(status_code=422, detail="Synthetic attestation required")
    snapshot = await CountySnapshotRepository(
        session, country_code="KE", county_code=county_code
    ).get(seed=seed, kind="pilot")
    if snapshot is None or not any(f["id"] == facility_id for f in snapshot.data["facilities"]):
        raise HTTPException(status_code=404, detail="Synthetic facility not found")
    settings = request.app.state.settings
    try:
        image = validate_image(
            await file.read(settings.max_upload_mb * 1024 * 1024 + 1),
            file.content_type or "",
            max_bytes=settings.max_upload_mb * 1024 * 1024,
        )
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail="Invalid image") from exc
    digest = sha256(image).hexdigest()
    stmt = select(CountyCapture).where(
        CountyCapture.country_code == "KE",
        CountyCapture.county_code == county_code,
        CountyCapture.idempotency_key == key,
    )
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        if (existing.facility_id, existing.created_by, existing.image_hash) != (
            facility_id,
            principal.subject,
            digest,
        ):
            raise HTTPException(status_code=409, detail="Idempotency key already used")
        response.status_code = 200
        return CaptureRead.model_validate(existing)
    try:
        result = await ExtractionCoordinator(
            request.app.state.capture_providers,
            PostgresExtractionStore(
                request.app.state.sessions, daily_cap=settings.llm_daily_call_cap
            ),
            cache_enabled=False,
        ).extract("KE", image)
        fields, provider_status = result.fields, "extracted"
    except (DailyLimitExceeded, ProviderUnavailable):
        fields = BinCardFields(
            commodity_name=None, opening_balance=None, closing_balance=None, record_date=None
        )
        provider_status = "manual_unavailable"
    await session.execute(
        insert(CountyCapture)
        .values(
            id=uuid4(),
            country_code="KE",
            county_code=county_code,
            facility_id=facility_id,
            idempotency_key=key,
            created_by=principal.subject,
            image_hash=digest,
            fields=fields.model_dump(mode="json"),
            provider_status=provider_status,
            status="pending",
        )
        .on_conflict_do_nothing(index_elements=["country_code", "county_code", "idempotency_key"])
    )
    saved = (await session.execute(stmt)).scalar_one()
    if (saved.facility_id, saved.created_by, saved.image_hash) != (
        facility_id,
        principal.subject,
        digest,
    ):
        raise HTTPException(status_code=409, detail="Idempotency key already used")
    return CaptureRead.model_validate(saved)


@router.post("/{capture_id}/confirm", status_code=201)
async def confirm_county_capture(
    county_code: str,
    facility_id: str,
    capture_id: UUID,
    data: CaptureConfirmation,
    response: Response,
    principal: Annotated[Principal, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> dict[str, Any]:
    await scope(session, principal, county_code, facility_id)
    capture = (
        await session.execute(
            select(CountyCapture)
            .where(
                CountyCapture.country_code == "KE",
                CountyCapture.county_code == county_code,
                CountyCapture.facility_id == facility_id,
                CountyCapture.id == capture_id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if capture is None:
        raise HTTPException(status_code=404, detail="Capture not found")
    fields = data.fields
    if (
        not fields.commodity_name
        or fields.opening_balance is None
        or fields.closing_balance is None
        or fields.record_date is None
    ):
        raise HTTPException(status_code=422, detail="All reviewed stock fields are required")
    values = fields.model_dump(mode="json")
    if capture.status == "confirmed":
        if capture.confirmed_fields != values:
            raise HTTPException(
                status_code=409, detail="Capture already confirmed with different values"
            )
        response.status_code = 200
    else:
        capture.status, capture.confirmed_fields, capture.confirmed_by = (
            "confirmed",
            values,
            principal.subject,
        )
    return {
        "synthetic": True,
        "capture_id": str(capture.id),
        "county_code": county_code,
        "facility_id": facility_id,
        "fields": values,
    }
