import hashlib
import shutil
from pathlib import Path
from typing import Annotated
from datetime import datetime, timezone

from fastapi import (
    FastAPI,
    HTTPException,
    Response,
    File,
    Form,
    UploadFile,
    status,
    Query,
)
from fastapi.responses import JSONResponse, FileResponse
from fastapi.encoders import jsonable_encoder
from fastapi.routing import APIRoute
from fastapi.exceptions import RequestValidationError

from app.models import (
    HealthResponse,
    SubmissionDetail,
    JobStatusResponse,
    DecisionRequest,
    SubmissionStatus,
    Verdict,
    Proposal,
    SchemaCard,
    ColumnInfo,
    ErrorResponse,
    SubmissionPage,
    DatasetPage,
    EntryPage,
    EntryDetail,
    HistoryPage,
    CatalogSearchResult,
    ReportData,
)
from app.database import get_db_connection


# Clean Operation IDs (function names become TypeScript method names)
def operation_id(route: APIRoute) -> str:
    return route.name


app = FastAPI(
    title="Schema Matcher Mock API",
    version="0.1.0",
    generate_unique_id_function=operation_id,
)


# Custom Exception for API Errors
class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message


@app.exception_handler(ApiError)
async def api_error_handler(request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status, content={"code": exc.code, "message": exc.message}
    )


# Uniform Validation Error Handler
@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "code": "validation_error",
            "message": "Request tidak valid",
            "details": jsonable_encoder(exc.errors()),
        },
    )


STORAGE_DIR = Path("storage/uploads")
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB limit


@app.get("/health", response_model=HealthResponse, tags=["health"])
def read_health():
    return HealthResponse(status="ok", version="0.1.0")


@app.get("/submissions", response_model=SubmissionPage, tags=["submissions"])
def read_submissions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: SubmissionStatus | None = None,
    verdict: Verdict | None = None,
):
    offset = (page - 1) * page_size
    where_clauses = []
    params = []

    if status:
        where_clauses.append("status = %s")
        params.append(status)
    if verdict:
        where_clauses.append("verdict = %s")
        params.append(verdict)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM submissions {where_sql};", params)
            total = cur.fetchone()["count"]

            query = f"SELECT * FROM submissions {where_sql} ORDER BY uploaded_at DESC LIMIT %s OFFSET %s;"
            cur.execute(query, params + [page_size, offset])
            rows = cur.fetchall()

            return {
                "items": rows,
                "total": total,
                "page": page,
                "page_size": page_size,
            }


@app.get(
    "/submissions/{submission_id}",
    response_model=SubmissionDetail,
    tags=["submissions"],
)
def read_submission_by_id(submission_id: str):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM submissions WHERE id = %s;", (submission_id,))
            row = cur.fetchone()

            if not row:
                raise ApiError(
                    status=404, code="not_found", message="Submission not found"
                )

            return SubmissionDetail(
                id=row["id"],
                file_name=row["file_name"],
                sheet=row["sheet"],
                size_bytes=row["size_bytes"],
                uploaded_at=row["uploaded_at"],
                status=row["status"],
                verdict=row["verdict"],
                similarity=row["similarity"],
                proposal=Proposal(
                    verdict=row["verdict"] or Verdict.new_dataset,
                    similarity=row["similarity"] or 0.0,
                    reason="Retrieved from PostgreSQL database record",
                    incoming=SchemaCard(
                        columns=[ColumnInfo(name="column_name", data_type="text")],
                        years=[2026],
                    ),
                    matched=None,
                ),
            )


@app.get("/submissions/{submission_id}/file", tags=["submissions"])
def download_submission_file(submission_id: str):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT sha256, file_name FROM submissions WHERE id = %s;",
                (submission_id,),
            )
            row = cur.fetchone()

            if not row:
                raise ApiError(
                    status=404, code="not_found", message="Submission not found"
                )

            file_path = STORAGE_DIR / f"{row['sha256']}_{row['file_name']}"
            if not file_path.exists():
                raise ApiError(
                    status=404,
                    code="not_found",
                    message="File binary not found on disk",
                )

            return FileResponse(
                path=file_path,
                filename=row["file_name"],
                media_type="application/octet-stream",
            )


@app.post(
    "/submissions",
    status_code=status.HTTP_202_ACCEPTED,
    tags=["submissions"],
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        415: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
async def create_submission(
    response: Response,
    file: Annotated[UploadFile, File(...)],
    sheet: Annotated[str | None, Form()] = None,
):
    # 415 Check: Validate file extension
    if not (file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise ApiError(
            status=415,
            code="unsupported_media_type",
            message="Format file tidak didukung. Harap unggah file .xlsx atau .xls.",
        )

    contents = await file.read()
    file_size = len(contents)

    # 413 Check: Validate file size limit (50MB)
    if file_size > MAX_FILE_SIZE:
        raise ApiError(
            status=413,
            code="payload_too_large",
            message=f"Ukuran file terlalu besar. Maksimal {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )

    sha256_hash = hashlib.sha256(contents).hexdigest()
    file_path = STORAGE_DIR / f"{sha256_hash}_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(contents)

    job_id = f"job_{sha256_hash[:8]}"
    submission_id = f"sub_{sha256_hash[:8]}"

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO submissions (id, file_name, sheet, size_bytes, sha256, status, verdict, similarity, uploaded_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) 
                ON CONFLICT (id) DO NOTHING;
                """,
                (
                    submission_id,
                    file.filename,
                    sheet,
                    file_size,
                    sha256_hash,
                    SubmissionStatus.draft,
                    Verdict.new_dataset,
                    0.0,
                    datetime.now(timezone.utc),
                ),
            )
            conn.commit()

    response.headers["Location"] = f"/jobs/{job_id}"

    return {
        "job_id": job_id,
        "submission_id": submission_id,
        "file_name": file.filename,
        "size_bytes": file_size,
        "sha256": sha256_hash,
        "status": "processing",
    }


@app.get("/jobs/{job_id}", response_model=JobStatusResponse, tags=["jobs"])
def get_job_status(job_id: str):
    sub_id = job_id.replace("job_", "sub_")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT uploaded_at FROM submissions WHERE id = %s;", (sub_id,))
            row = cur.fetchone()

            if not row:
                raise ApiError(status=404, code="not_found", message="Job Not Found")

            uploaded_at = row["uploaded_at"]
            now = datetime.now(timezone.utc)
            elapsed = (now - uploaded_at).total_seconds()

            if elapsed < 100:
                progress = int((elapsed / 100) * 100)
                return {
                    "job_id": job_id,
                    "status": "processing",
                    "progress": progress,
                    "message": "Analyzing columns and matching schema...",
                }
            else:
                return {
                    "job_id": job_id,
                    "status": "completed",
                    "progress": 100,
                    "message": "Processing complete. Schema matched successfully.",
                }


@app.post("/submissions/{submission_id}/decision", tags=["submissions"])
def make_submission_decision(submission_id: str, decision: DecisionRequest):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Retrieve existing submission record to check for business rule conflicts
            cur.execute(
                "SELECT status, verdict FROM submissions WHERE id = %s;",
                (submission_id,),
            )
            row = cur.fetchone()

            if not row:
                raise ApiError(
                    status=404, code="not_found", message="Submission Not Found"
                )

            # 409 Conflict Check 1: Already accepted or merged
            if row["status"] in [SubmissionStatus.accepted, SubmissionStatus.merged]:
                raise ApiError(
                    status=409,
                    code="conflict",
                    message="Submission sudah diproses dan tidak dapat diubah.",
                )

            # 409 Conflict Check 2: Cannot accept a 'needs_review' submission without a explicit verdict decision
            if row["verdict"] == Verdict.needs_review and decision.action == "accept":
                raise ApiError(
                    status=409,
                    code="conflict",
                    message="Tidak dapat menerima submission dengan verdict needs_review tanpa vonis manual.",
                )

            new_status = (
                SubmissionStatus.accepted
                if decision.action == "accept"
                else SubmissionStatus.draft
            )

            cur.execute(
                "UPDATE submissions SET status = %s WHERE id = %s RETURNING id;",
                (new_status, submission_id),
            )
            conn.commit()
            return {
                "submission_id": submission_id,
                "status": new_status,
                "action_taken": decision.action,
                "note": decision.note,
            }


@app.post("/dev/reset", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def dev_reset():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE submissions, jobs RESTART IDENTITY CASCADE;")
            conn.commit()

    if STORAGE_DIR.exists():
        for item in STORAGE_DIR.iterdir():
            if item.is_file():
                item.unlink()


# --- V1.1 CATALOG & REPORT STUBS ---


@app.get("/catalog/datasets", response_model=DatasetPage, tags=["catalog"])
def list_datasets(q: str | None = None, page: int = 1, page_size: int = 10):
    return {
        "items": [
            {"dataset_id": "ds_01", "name": "Konsumsi Gizi Nasional", "entry_count": 3},
            {"dataset_id": "ds_02", "name": "PDRB Regional", "entry_count": 2},
        ],
        "total": 2,
        "page": page,
        "page_size": page_size,
    }


@app.get(
    "/catalog/datasets/{dataset_id}/entries", response_model=EntryPage, tags=["catalog"]
)
def list_dataset_entries(dataset_id: str, page: int = 1, page_size: int = 10):
    return {
        "items": [
            {
                "entry_id": "ent_01",
                "dataset_id": dataset_id,
                "file_name": "gizi_2024.xlsx",
                "source": "BPS",
                "status": "merged",
                "years": [2023, 2024],
                "updated_at": datetime.now(timezone.utc),
            }
        ],
        "total": 1,
        "page": page,
        "page_size": page_size,
    }


@app.get("/catalog/entries/{entry_id}", response_model=EntryDetail, tags=["catalog"])
def get_entry_detail(entry_id: str):
    return {
        "entry_id": entry_id,
        "dataset_id": "ds_01",
        "dataset_name": "Konsumsi Gizi Nasional",
        "file_name": "gizi_2024.xlsx",
        "source": "BPS",
        "status": "merged",
        "years": [2023, 2024],
        "updated_at": datetime.now(timezone.utc),
        "columns": [
            {"name": "provinsi", "data_type": "text"},
            {"name": "kalori", "data_type": "number"},
        ],
    }


@app.get(
    "/catalog/entries/{entry_id}/history", response_model=HistoryPage, tags=["catalog"]
)
def get_entry_history(entry_id: str, page: int = 1, page_size: int = 10):
    return {"items": [], "total": 0, "page": page, "page_size": page_size}


@app.get("/catalog/search", response_model=CatalogSearchResult, tags=["catalog"])
def catalog_search(q: str):
    return {
        "datasets": [
            {"dataset_id": "ds_01", "name": "Konsumsi Gizi Nasional", "entry_count": 3}
        ],
        "columns": [
            {
                "column_name": "kalori",
                "entry_id": "ent_01",
                "dataset_id": "ds_01",
                "file_name": "gizi_2024.xlsx",
            }
        ],
    }


@app.get("/reports/submissions", response_model=ReportData, tags=["reports"])
def export_submissions_report(
    status: SubmissionStatus | None = None, verdict: Verdict | None = None
):
    return {"generated_at": datetime.now(timezone.utc), "total": 0, "rows": []}
