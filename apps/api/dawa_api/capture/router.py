"""Synthetic-only capture with explicit human confirmation."""

import re
from hashlib import sha256
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from dawa_api.auth.service import Principal
from dawa_api.capture.extraction import (
    BinCardFields,
    DailyLimitExceeded,
    ExtractionCoordinator,
    Provider,
    ProviderUnavailable,
)
from dawa_api.capture.images import ImageValidationError, validate_image
from dawa_api.capture.repository import CaptureConflict, CaptureRepository, PostgresExtractionStore
from dawa_api.capture.schemas import CaptureConfirmation, CapturePage, CaptureRead, StockEntryRead
from dawa_api.scenarios.router import current_principal, session_for_request
from dawa_api.settings import Settings

router = APIRouter(prefix="/captures", tags=["capture"])


def _can_access(principal: Principal, facility_id: str) -> bool:
    return principal.role != "facility" or principal.facility_id == facility_id


def _is_demo_facility(country: str, facility_id: str) -> bool:
    return bool(
        re.fullmatch(rf"SYN-{re.escape(country)}-F(?:00[1-9]|0[1-3][0-9]|040)", facility_id)
    )


@router.post("", response_model=CaptureRead, status_code=status.HTTP_201_CREATED)
async def create_capture(
    request: Request,
    response: Response,
    principal: Annotated[Principal, Depends(current_principal)],
    facility_id: Annotated[str, Form(min_length=1, max_length=64)],
    synthetic_attested: Annotated[bool, Form()],
    file: Annotated[UploadFile, File()],
    key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=128)],
) -> CaptureRead:
    if not synthetic_attested or not _is_demo_facility(principal.country_code, facility_id):
        raise HTTPException(
            status_code=422, detail="Only attested synthetic demo images and facilities are allowed"
        )
    if not _can_access(principal, facility_id):
        raise HTTPException(status_code=403, detail="Facility access denied")
    settings: Settings = request.app.state.settings
    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    try:
        image = validate_image(
            content, file.content_type or "", max_bytes=settings.max_upload_mb * 1024 * 1024
        )
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail="Invalid image type, content, or size") from exc
    digest = sha256(image).hexdigest()
    sessions: async_sessionmaker[AsyncSession] = request.app.state.sessions
    async with sessions.begin() as session:
        existing = await CaptureRepository(
            session, country_code=principal.country_code
        ).find_by_key(key)
        if existing is not None:
            if (existing.facility_id, existing.created_by, existing.image_hash) != (
                facility_id,
                principal.subject,
                digest,
            ):
                raise HTTPException(status_code=409, detail="Idempotency key already used")
            response.status_code = 200
            return CaptureRead.model_validate(existing)
    providers: list[Provider] = request.app.state.capture_providers
    store = PostgresExtractionStore(sessions, daily_cap=settings.llm_daily_call_cap)
    try:
        extracted = await ExtractionCoordinator(
            providers, store, cache_enabled=settings.llm_cache_by_image_hash
        ).extract(principal.country_code, image)
        fields = extracted.fields
        provider_status = "cached" if extracted.cached else "extracted"
    except DailyLimitExceeded:
        fields = BinCardFields(
            commodity_name=None, opening_balance=None, closing_balance=None, record_date=None
        )
        provider_status = "manual_limit"
    except ProviderUnavailable:
        fields = BinCardFields(
            commodity_name=None, opening_balance=None, closing_balance=None, record_date=None
        )
        provider_status = "manual_unavailable"
    async with sessions.begin() as session:
        try:
            draft, created = await CaptureRepository(
                session, country_code=principal.country_code
            ).create(key, facility_id, principal.subject, digest, fields, provider_status)
        except CaptureConflict as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        response.status_code = 201 if created else 200
        return CaptureRead.model_validate(draft)


@router.get("", response_model=CapturePage)
async def list_captures(
    principal: Annotated[Principal, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
    facility_id: Annotated[str, Query(min_length=1, max_length=64)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CapturePage:
    if not _is_demo_facility(principal.country_code, facility_id) or not _can_access(
        principal, facility_id
    ):
        raise HTTPException(status_code=404, detail="Facility not found")
    drafts = await CaptureRepository(session, country_code=principal.country_code).list_page(
        facility_id=facility_id, limit=limit, offset=offset
    )
    return CapturePage(
        items=[CaptureRead.model_validate(draft) for draft in drafts], limit=limit, offset=offset
    )


@router.get("/{capture_id}", response_model=CaptureRead)
async def get_capture(
    capture_id: UUID,
    principal: Annotated[Principal, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> CaptureRead:
    draft = await CaptureRepository(session, country_code=principal.country_code).get(capture_id)
    if draft is None or not _can_access(principal, draft.facility_id):
        raise HTTPException(status_code=404, detail="Capture not found")
    return CaptureRead.model_validate(draft)


@router.post(
    "/{capture_id}/confirm", response_model=StockEntryRead, status_code=status.HTTP_201_CREATED
)
async def confirm_capture(
    capture_id: UUID,
    data: CaptureConfirmation,
    response: Response,
    principal: Annotated[Principal, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(session_for_request)],
) -> StockEntryRead:
    repository = CaptureRepository(session, country_code=principal.country_code)
    draft = await repository.get(capture_id, lock=True)
    if draft is None or not _can_access(principal, draft.facility_id):
        raise HTTPException(status_code=404, detail="Capture not found")
    try:
        entry, created = await repository.confirm(
            capture_id, data.fields, principal.subject, reviewed=data.reviewed
        )
    except CaptureConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    response.status_code = 201 if created else 200
    return StockEntryRead.model_validate(entry)
