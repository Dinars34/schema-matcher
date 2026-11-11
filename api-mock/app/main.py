import hashlib
import io
import posixpath
import re
import zipfile
from datetime import date
from xml.etree import ElementTree
from pathlib import PurePosixPath
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, Form, Header, Query, Response, UploadFile, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from app.database import MockStore, get_store
from app.errors import StoreError
from app.fixtures import scenario_names
from app.models import (
    CatalogSearchResult,
    DatasetPage,
    DecisionRequest,
    DecisionResponse,
    EntryDetail,
    EntryPage,
    ErrorResponse,
    HealthResponse,
    HistoryPage,
    JobStatusResponse,
    ReportData,
    SubmissionDetail,
    SubmissionPage,
    SubmissionStatus,
    UploadResponse,
    Verdict,
)


MAX_FILE_SIZE = 50 * 1024 * 1024
CONTRACT_VERSION = "1.1.0"


def operation_id(route: APIRoute) -> str:
    return route.name


app = FastAPI(
    title="Schema Matcher Mock API",
    version="0.1.0",
    generate_unique_id_function=operation_id,
)


@app.exception_handler(StoreError)
async def store_error_handler(_request, exc: StoreError):
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "details": None},
    )


@app.exception_handler(RequestValidationError)
async def validation_handler(_request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "code": "validation_error",
            "message": "Request tidak valid",
            "details": jsonable_encoder(exc.errors()),
        },
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    responses={},
    tags=["health"],
)
def read_health():
    return HealthResponse(
        status="ok",
        version=app.version,
        contract_version=CONTRACT_VERSION,
        features=["queue", "catalog", "history", "report"],
    )


@app.get(
    "/submissions",
    response_model=SubmissionPage,
    responses={422: {"model": ErrorResponse}},
    tags=["submissions"],
)
def read_submissions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status_filter: Annotated[
        SubmissionStatus | None, Query(alias="status")
    ] = None,
    verdict: Verdict | None = None,
    uploaded_from: date | None = None,
    uploaded_to: date | None = None,
    sort: Literal["uploaded_at", "-uploaded_at"] = "-uploaded_at",
    store: MockStore = Depends(get_store),
):
    if uploaded_from and uploaded_to and uploaded_from > uploaded_to:
        raise StoreError(422, "validation_error", "uploaded_from harus sebelum uploaded_to.")
    return store.list_submissions(
        page,
        page_size,
        status_filter.value if status_filter else None,
        verdict.value if verdict else None,
        uploaded_from.isoformat() if uploaded_from else None,
        uploaded_to.isoformat() if uploaded_to else None,
        sort,
    )


@app.get(
    "/submissions/{submission_id}",
    response_model=SubmissionDetail,
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
    tags=["submissions"],
)
def read_submission_by_id(
    submission_id: str, store: MockStore = Depends(get_store)
):
    submission = store.get_submission(submission_id)
    if submission is None:
        raise StoreError(404, "not_found", "Submission not found.")
    return submission


@app.get(
    "/submissions/{submission_id}/file",
    responses={
        200: {
            "description": "Original uploaded bytes",
            "content": {
                "application/octet-stream": {
                    "schema": {"type": "string", "format": "binary"}
                }
            },
        },
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
    tags=["submissions"],
)
def download_submission_file(
    submission_id: str, store: MockStore = Depends(get_store)
):
    file_record = store.get_file(submission_id)
    if file_record is None:
        raise StoreError(404, "not_found", "Submission not found.")
    content, file_name = file_record
    content_disposition = f"attachment; filename*=UTF-8''{quote(file_name)}"
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": content_disposition},
    )


def _safe_filename(filename: str | None) -> str:
    name = PurePosixPath((filename or "").replace("\\", "/")).name
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).replace('"', "").strip()
    if not name or name in {".", ".."}:
        name = "upload.xlsx"
    return name[:255]


def _is_xlsx(data: bytes) -> bool:
    if not data.startswith(b"PK"):
        return False
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as workbook:
            names = workbook.namelist()
            required_files = {
                "[Content_Types].xml",
                "xl/workbook.xml",
                "xl/_rels/workbook.xml.rels",
            }
            if not required_files.issubset(names):
                return False

            def read_metadata(path: str) -> bytes | None:
                with workbook.open(path) as member:
                    content = member.read(4 * 1024 * 1024 + 1)
                return content if len(content) <= 4 * 1024 * 1024 else None

            content_types_data = read_metadata("[Content_Types].xml")
            workbook_data = read_metadata("xl/workbook.xml")
            relationships_data = read_metadata("xl/_rels/workbook.xml.rels")
            if content_types_data is None or workbook_data is None or relationships_data is None:
                return False
            content_types = ElementTree.fromstring(content_types_data)
            workbook_xml = ElementTree.fromstring(workbook_data)
            relationships_xml = ElementTree.fromstring(relationships_data)
            if content_types.tag.rsplit("}", 1)[-1] != "Types":
                return False
            if workbook_xml.tag.rsplit("}", 1)[-1] != "workbook":
                return False
            if relationships_xml.tag.rsplit("}", 1)[-1] != "Relationships":
                return False
            workbook_override = any(
                node.attrib.get("PartName") == "/xl/workbook.xml"
                and "spreadsheetml.sheet.main+xml" in node.attrib.get("ContentType", "")
                for node in content_types
            )
            sheets = next(
                (node for node in workbook_xml if node.tag.rsplit("}", 1)[-1] == "sheets"),
                None,
            )
            if not workbook_override or sheets is None:
                return False
            relationship_targets = {
                node.attrib.get("Id"): node.attrib.get("Target")
                for node in relationships_xml
                if node.attrib.get("Type", "").endswith("/worksheet")
            }
            for sheet in sheets:
                relationship_id = next(
                    (
                        value
                        for key, value in sheet.attrib.items()
                        if key.rsplit("}", 1)[-1] == "id"
                    ),
                    None,
                )
                target = relationship_targets.get(relationship_id)
                if target:
                    target_path = posixpath.normpath(
                        target.lstrip("/") if target.startswith("/") else posixpath.join("xl", target)
                    )
                    if (
                        target_path.startswith("xl/worksheets/")
                        and target_path in names
                    ):
                        return True
            return False
    except (
        OSError,
        zipfile.BadZipFile,
        ValueError,
        ElementTree.ParseError,
        KeyError,
        RuntimeError,
    ):
        return False


def _is_xls(data: bytes) -> bool:
    if len(data) < 512 or data[:8] != bytes.fromhex("D0CF11E0A1B11AE1"):
        return False
    sector_shift = int.from_bytes(data[30:32], "little")
    if sector_shift not in {9, 12} or data[28:30] != b"\xfe\xff":
        return False
    sector_size = 1 << sector_shift
    directory_sector = int.from_bytes(data[48:52], "little")
    fat_sector_count = int.from_bytes(data[44:48], "little")
    difat = [
        int.from_bytes(data[offset : offset + 4], "little")
        for offset in range(76, 512, 4)
    ]
    fat_sector_ids = [sector for sector in difat if sector < 0xFFFFFFFA]
    next_difat_sector = int.from_bytes(data[68:72], "little")
    difat_sector_count = int.from_bytes(data[72:76], "little")
    seen_difat: set[int] = set()
    for _ in range(difat_sector_count):
        if next_difat_sector >= 0xFFFFFFFA or next_difat_sector in seen_difat:
            return False
        seen_difat.add(next_difat_sector)
        start = (next_difat_sector + 1) * sector_size
        sector = data[start : start + sector_size]
        if len(sector) != sector_size:
            return False
        fat_sector_ids.extend(
            int.from_bytes(sector[offset : offset + 4], "little")
            for offset in range(0, sector_size - 4, 4)
            if int.from_bytes(sector[offset : offset + 4], "little") < 0xFFFFFFFA
        )
        next_difat_sector = int.from_bytes(sector[-4:], "little")
    if not fat_sector_ids or fat_sector_count > len(fat_sector_ids):
        return False
    fat: list[int] = []
    for sector_id in fat_sector_ids[:fat_sector_count]:
        start = (sector_id + 1) * sector_size
        sector = data[start : start + sector_size]
        if len(sector) != sector_size:
            return False
        fat.extend(
            int.from_bytes(sector[offset : offset + 4], "little")
            for offset in range(0, sector_size, 4)
        )
    def regular_stream(start_sector: int, maximum: int | None = None) -> bytes | None:
        sector_id = start_sector
        seen: set[int] = set()
        stream = bytearray()
        while sector_id < 0xFFFFFFFA and sector_id not in seen and len(seen) <= len(fat):
            if sector_id >= len(fat):
                return None
            seen.add(sector_id)
            start = (sector_id + 1) * sector_size
            sector = data[start : start + sector_size]
            if len(sector) != sector_size:
                return None
            stream.extend(sector)
            if maximum is not None and len(stream) >= maximum:
                return bytes(stream[:maximum])
            sector_id = fat[sector_id]
        return bytes(stream)

    directory = regular_stream(directory_sector)
    if directory is None:
        return False
    workbook_stream: tuple[int, int] | None = None
    root_stream: tuple[int, int] | None = None
    for offset in range(0, len(directory), 128):
        record = directory[offset : offset + 128]
        if len(record) < 128:
            continue
        record_type = record[66]
        name_length = int.from_bytes(record[64:66], "little")
        if name_length < 2 or name_length > 64 or name_length % 2:
            continue
        name = record[: name_length - 2].decode("utf-16le", errors="ignore")
        start_sector = int.from_bytes(record[116:120], "little")
        stream_size = int.from_bytes(record[120:128], "little")
        if record_type == 2 and name in {"Workbook", "Book"}:
            workbook_stream = (start_sector, stream_size)
        elif record_type == 5:
            root_stream = (start_sector, stream_size)
    if workbook_stream is None:
        return False
    workbook_start, workbook_size = workbook_stream
    if workbook_size < 4:
        return False
    mini_stream_cutoff = int.from_bytes(data[56:60], "little")
    if workbook_size >= mini_stream_cutoff:
        stream = regular_stream(workbook_start, workbook_size)
    else:
        first_mini_fat = int.from_bytes(data[60:64], "little")
        mini_fat_sector_count = int.from_bytes(data[64:68], "little")
        mini_fat_bytes = regular_stream(
            first_mini_fat, mini_fat_sector_count * sector_size
        )
        if root_stream is None or mini_fat_bytes is None:
            return False
        root_bytes = regular_stream(root_stream[0], root_stream[1])
        if root_bytes is None:
            return False
        mini_sector_size = 1 << int.from_bytes(data[32:34], "little")
        mini_fat = [
            int.from_bytes(mini_fat_bytes[offset : offset + 4], "little")
            for offset in range(0, len(mini_fat_bytes), 4)
        ]
        mini_id = workbook_start
        seen_mini: set[int] = set()
        stream_bytes = bytearray()
        while (
            mini_id < 0xFFFFFFFA
            and mini_id not in seen_mini
            and len(seen_mini) <= len(mini_fat)
            and len(stream_bytes) < workbook_size
        ):
            start = mini_id * mini_sector_size
            if mini_id >= len(mini_fat) or start + mini_sector_size > len(root_bytes):
                return False
            seen_mini.add(mini_id)
            stream_bytes.extend(root_bytes[start : start + mini_sector_size])
            mini_id = mini_fat[mini_id]
        stream = bytes(stream_bytes[:workbook_size])
    if stream is None or len(stream) < 6:
        return False
    record_type = stream[:2]
    record_size = int.from_bytes(stream[2:4], "little")
    version = stream[4:6]
    return (
        record_type in {b"\x09\x08", b"\x09\x00", b"\x09\x02", b"\x09\x04"}
        and version in {b"\x00\x02", b"\x00\x03", b"\x00\x04", b"\x00\x05", b"\x00\x06"}
        and 4 < record_size
        and 4 + record_size <= workbook_size
    )


@app.post(
    "/submissions",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=UploadResponse,
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        415: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
    tags=["submissions"],
)
async def create_submission(
    response: Response,
    file: Annotated[UploadFile, File(...)],
    sheet: Annotated[str | None, Form()] = None,
    x_mock_scenario: Annotated[str | None, Header(include_in_schema=False)] = None,
    store: MockStore = Depends(get_store),
):
    file_name = _safe_filename(file.filename)
    suffix = PurePosixPath(file_name).suffix.casefold()
    if suffix not in {".xlsx", ".xls"}:
        raise StoreError(
            415,
            "unsupported_media_type",
            "Format file tidak didukung. Unggah workbook .xlsx atau .xls yang valid.",
        )
    if x_mock_scenario and x_mock_scenario not in scenario_names():
        raise StoreError(422, "validation_error", "Skenario mock tidak dikenal.")

    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise StoreError(
            413,
            "payload_too_large",
            "Ukuran file terlalu besar. Maksimal 50 MB.",
        )
    valid_workbook = _is_xlsx(content) if suffix == ".xlsx" else _is_xls(content)
    if not valid_workbook:
        raise StoreError(
            415,
            "unsupported_media_type",
            "Isi file tidak sesuai dengan format workbook yang dinyatakan.",
        )

    digest = hashlib.sha256(content).hexdigest()
    try:
        upload, _ = store.create_submission(
            file_name, sheet, content, digest, x_mock_scenario
        )
    except ValueError as exc:
        raise StoreError(422, "validation_error", str(exc)) from exc
    response.headers["Location"] = f"/jobs/{upload['job_id']}"
    return upload


@app.get(
    "/jobs/{job_id}",
    response_model=JobStatusResponse,
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
    tags=["jobs"],
)
def get_job_status(job_id: str, store: MockStore = Depends(get_store)):
    job = store.get_job(job_id)
    if job is None:
        raise StoreError(404, "not_found", "Job not found.")
    return job


@app.post(
    "/submissions/{submission_id}/decision",
    response_model=DecisionResponse,
    responses={
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
    tags=["submissions"],
)
def make_submission_decision(
    submission_id: str,
    decision: DecisionRequest,
    store: MockStore = Depends(get_store),
):
    return store.decide(submission_id, decision)


@app.get(
    "/catalog/datasets",
    response_model=DatasetPage,
    responses={422: {"model": ErrorResponse}},
    tags=["catalog"],
)
def list_datasets(
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    store: MockStore = Depends(get_store),
):
    return store.list_datasets(q, page, page_size)


@app.get(
    "/catalog/datasets/{dataset_id}/entries",
    response_model=EntryPage,
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
    tags=["catalog"],
)
def list_dataset_entries(
    dataset_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    store: MockStore = Depends(get_store),
):
    result = store.list_entries(dataset_id, page, page_size)
    if result is None:
        raise StoreError(404, "not_found", "Dataset not found.")
    return result


@app.get(
    "/catalog/entries/{entry_id}",
    response_model=EntryDetail,
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
    tags=["catalog"],
)
def get_entry_detail(entry_id: str, store: MockStore = Depends(get_store)):
    entry = store.get_entry(entry_id)
    if entry is None:
        raise StoreError(404, "not_found", "Entry not found.")
    return entry


@app.get(
    "/catalog/entries/{entry_id}/history",
    response_model=HistoryPage,
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
    tags=["catalog"],
)
def get_entry_history(
    entry_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    store: MockStore = Depends(get_store),
):
    history = store.get_history(entry_id, page, page_size)
    if history is None:
        raise StoreError(404, "not_found", "Entry not found.")
    return history


@app.get(
    "/catalog/search",
    response_model=CatalogSearchResult,
    responses={422: {"model": ErrorResponse}},
    tags=["catalog"],
)
def catalog_search(q: str = Query(min_length=1), store: MockStore = Depends(get_store)):
    return store.search_catalog(q)


@app.get(
    "/reports/submissions",
    response_model=ReportData,
    responses={422: {"model": ErrorResponse}},
    tags=["reports"],
)
def export_submissions_report(
    status_filter: Annotated[SubmissionStatus | None, Query(alias="status")] = None,
    verdict: Verdict | None = None,
    uploaded_from: date | None = None,
    uploaded_to: date | None = None,
    ids: str | None = None,
    sort: Literal["uploaded_at", "-uploaded_at"] = "-uploaded_at",
    store: MockStore = Depends(get_store),
):
    if uploaded_from and uploaded_to and uploaded_from > uploaded_to:
        raise StoreError(422, "validation_error", "uploaded_from harus sebelum uploaded_to.")
    id_values = [value.strip() for value in ids.split(",") if value.strip()] if ids else None
    return store.report(
        status_filter.value if status_filter else None,
        verdict.value if verdict else None,
        uploaded_from.isoformat() if uploaded_from else None,
        uploaded_to.isoformat() if uploaded_to else None,
        id_values,
        sort,
    )
