from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Verdict(StrEnum):
    new_dataset = "new_dataset"
    new_source = "new_source"
    enrichment = "enrichment"
    duplicate = "duplicate"
    needs_review = "needs_review"


class SubmissionStatus(StrEnum):
    processing = "processing"
    draft = "draft"
    accepted = "accepted"
    merged = "merged"
    rejected = "rejected"


class EntryStatus(StrEnum):
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


class DecisionRecord(BaseModel):
    action: Literal["accept", "reject"]
    verdict: Verdict | None = None
    target_entry_id: str | None = None
    note: str | None = None
    decided_by: str | None = Field(default=None, max_length=80)
    decided_at: datetime


class Submission(BaseModel):
    id: str
    file_name: str
    sheet: str | None = None
    size_bytes: int
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    uploaded_at: datetime
    status: SubmissionStatus
    verdict: Verdict | None = None
    similarity: float | None = Field(default=None, ge=0, le=1)
    matched_file_name: str | None = None
    reason_short: str | None = Field(default=None, max_length=120)


class SubmissionDetail(Submission):
    proposal: Proposal | None = None
    decision: DecisionRecord | None = None


class UploadResponse(BaseModel):
    job_id: str
    submission_id: str
    file_name: str
    size_bytes: int
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    status: Literal["processing"]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
    contract_version: str = "1.1.0"
    features: list[Literal["queue", "catalog", "history", "report"]] = [
        "queue",
        "catalog",
        "history",
        "report",
    ]


class JobStatusResponse(BaseModel):
    job_id: str
    status: Literal["processing", "completed", "failed"]
    progress: int = Field(ge=0, le=100)
    message: str


class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["accept", "reject"]
    verdict: Verdict | None = None
    target_entry_id: str | None = None
    note: str | None = None
    decided_by: str | None = Field(default=None, max_length=80)


class DecisionResponse(BaseModel):
    submission_id: str
    status: SubmissionStatus
    action_taken: Literal["accept", "reject"]
    note: str | None = None


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: list[dict[str, Any]] | None = None


class SubmissionPage(BaseModel):
    items: list[Submission]
    total: int
    page: int
    page_size: int


class DatasetSummary(BaseModel):
    dataset_id: str
    name: str
    entry_count: int


class EntrySummary(BaseModel):
    entry_id: str
    dataset_id: str
    file_name: str
    source: str | None = None
    status: EntryStatus
    years: list[int]
    updated_at: datetime


class EntryDetail(EntrySummary):
    dataset_name: str
    columns: list[ColumnInfo]


class EntrySnapshot(BaseModel):
    source: str | None = None
    years: list[int]
    columns: list[ColumnInfo]


class HistoryEvent(BaseModel):
    event_id: str
    entry_id: str
    submission_id: str | None = None
    action: str
    decided_by: str | None = None
    decided_at: datetime
    before: EntrySnapshot | None = None
    after: EntrySnapshot | None = None


class DatasetPage(BaseModel):
    items: list[DatasetSummary]
    total: int
    page: int
    page_size: int


class EntryPage(BaseModel):
    items: list[EntrySummary]
    total: int
    page: int
    page_size: int


class HistoryPage(BaseModel):
    items: list[HistoryEvent]
    total: int
    page: int
    page_size: int


class ColumnHit(BaseModel):
    column_name: str
    entry_id: str
    dataset_id: str
    file_name: str


class CatalogSearchResult(BaseModel):
    datasets: list[DatasetSummary]
    columns: list[ColumnHit]


class ReportData(BaseModel):
    generated_at: datetime
    total: int
    rows: list[Submission]
