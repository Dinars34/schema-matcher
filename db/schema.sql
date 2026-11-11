-- PostgreSQL reference schema. Apply only to a newly created, dedicated database.
-- This file intentionally contains no DROP/TRUNCATE statements.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS datasets (
    dataset_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entries (
    entry_id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),
    file_name TEXT NOT NULL,
    source TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'accepted', 'merged')),
    years INTEGER[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entries_dataset_updated_idx
    ON entries(dataset_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS entry_columns (
    entry_id TEXT NOT NULL REFERENCES entries(entry_id) ON DELETE CASCADE,
    column_name TEXT NOT NULL,
    element_name TEXT,
    data_type TEXT NOT NULL CHECK (data_type IN ('text', 'number', 'date')),
    PRIMARY KEY (entry_id, column_name)
);

CREATE TABLE IF NOT EXISTS entry_embeddings (
    entry_id TEXT PRIMARY KEY REFERENCES entries(entry_id) ON DELETE CASCADE,
    embedding vector(1024) NOT NULL,
    input_text TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
    submission_id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    sheet TEXT,
    size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 0 AND 52428800),
    sha256 CHAR(64) NOT NULL,
    storage_key TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL CHECK (
        status IN ('processing', 'draft', 'accepted', 'merged', 'rejected')
    ),
    verdict TEXT CHECK (
        verdict IS NULL OR verdict IN (
            'new_dataset', 'new_source', 'enrichment', 'duplicate', 'needs_review'
        )
    ),
    similarity DOUBLE PRECISION CHECK (similarity IS NULL OR similarity BETWEEN 0 AND 1),
    proposal JSONB,
    decision JSONB
);
CREATE INDEX IF NOT EXISTS submissions_uploaded_at_idx
    ON submissions(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS submissions_status_verdict_idx
    ON submissions(status, verdict);

CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(submission_id),
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
    progress SMALLINT NOT NULL CHECK (progress BETWEEN 0 AND 100),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submission_decisions (
    decision_id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(submission_id),
    action TEXT NOT NULL CHECK (action IN ('accept', 'reject')),
    verdict TEXT CHECK (
        verdict IS NULL OR verdict IN (
            'new_dataset', 'new_source', 'enrichment', 'duplicate', 'needs_review'
        )
    ),
    target_entry_id TEXT REFERENCES entries(entry_id),
    note TEXT,
    decided_by TEXT CHECK (decided_by IS NULL OR length(decided_by) <= 80),
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entry_history (
    event_id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES entries(entry_id),
    submission_id TEXT REFERENCES submissions(submission_id),
    action TEXT NOT NULL,
    decided_by TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    before_state JSONB,
    after_state JSONB,
    CHECK (before_state IS NOT NULL OR after_state IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS entry_history_entry_time_idx
    ON entry_history(entry_id, decided_at DESC);
