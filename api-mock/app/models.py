from datetime import datetime
from enum import Enum
from typing import Literal, Any
from pydantic import BaseModel, Field


class Verdict(str, Enum):
    new_dataset = "new_dataset"
    new_source = "new_source"
    enrichment = "enrichment"
    duplicate = "duplicate"
    needs_review = "needs_review"


class SubmissionStatus(str, Enum):
    processing = "processing"
    draft = "draft"
    accepted = "accepted"
    merged = "merged"


class ColumnInfo(BaseModel):
    name: str
    element_name: str | None = None
    data_type: Literal["text", "number", "date"]


class SchemaCard(BaseModel):
    columns: list[ColumnInfo]
    years: list[int]


class EntryRef(BaseModel):
    entry_id: str
    file_name: str
    dataset: str
    source: str | None = None
    schema_card: SchemaCard


class Proposal(BaseModel):
    verdict: Verdict
    similarity: float = Field(ge=0, le=1)
    reason: str
    incoming: SchemaCard
    matched: EntryRef | None = None


class Submission(BaseModel):
    id: str
    file_name: str
    sheet: str | None = None
    size_bytes: int
    uploaded_at: datetime
    status: SubmissionStatus
    verdict: Verdict | None = None
    similarity: float | None = Field(default=None, ge=0, le=1)


class SubmissionDetail(Submission):
    proposal: Proposal | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


# Job status tracking for background processing
class JobStatusResponse(BaseModel):
    job_id: str
    status: Literal["processing", "completed", "failed"]
    progress: int = Field(ge=0, le=100)
    message: str


# Request body for accepting/rejecting a match proposal
class DecisionRequest(BaseModel):
    action: Literal["accept", "reject"]
    note: str | None = None


health = HealthResponse(status="ok", version="0.1.0")
print(health.model_dump_json())


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: list[dict[str, Any]] | None = None


class SubmissionPage(BaseModel):
    items: list[dict[str, Any]]
    total: int
    page: int
    page_size: int
