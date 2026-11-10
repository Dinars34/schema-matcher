from datetime import datetime, timezone
from .models import (
    SubmissionDetail,
    Verdict,
    SubmissionStatus,
    SchemaCard,
    ColumnInfo,
    Proposal,
    EntryRef,
)

MOCK_SUBMISSIONS = {
    "sub_111": SubmissionDetail(
        id="sub_111",
        file_name="data_gizi_2024.xlsx",
        sheet="Sheet1",
        size_bytes=15420,
        uploaded_at=datetime.now(timezone.utc),
        status=SubmissionStatus.draft,
        verdict=Verdict.enrichment,
        similarity=0.92,
        proposal=Proposal(
            verdict=Verdict.enrichment,
            similarity=0.92,
            reason="Struktur kolom sangat mirip dengan dataset gizi nasional.",
            incoming=SchemaCard(
                columns=[
                    ColumnInfo(name="kabupaten", data_type="text"),
                    ColumnInfo(name="jumlah_kasus", data_type="number"),
                ],
                years=[2024],
            ),
            matched=EntryRef(
                entry_id="ent_99",
                file_name="gizi_2023.xlsx",
                dataset="Dataset Gizi",
                schema_card=SchemaCard(columns=[], years=[2023]),
            ),
        ),
    ),
    "sub_112": SubmissionDetail(
        id="sub_112",
        file_name="data_ispa_2026.xlsx",
        sheet="Sheet1",
        size_bytes=15421,
        uploaded_at=datetime.now(timezone.utc),
        status=SubmissionStatus.draft,
        verdict=Verdict.needs_review,
        similarity=0.95,
        proposal=Proposal(
            verdict=Verdict.needs_review,
            similarity=0.96,
            reason="Struktur kolom sangat mirip dengan dataset ispa nasional.",
            incoming=SchemaCard(
                columns=[
                    ColumnInfo(name="kabupaten", data_type="text"),
                    ColumnInfo(name="jumlah_kasus", data_type="number"),
                ],
                years=[2024],
            ),
        ),
    ),
}
