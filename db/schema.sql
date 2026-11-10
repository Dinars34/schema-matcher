-- Drop tables if resetting (Optional for development)
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS jobs;

-- 1. Submissions table storing all metadata, hashes, and match statuses
CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(64) PRIMARY KEY,
    file_name TEXT NOT NULL,
    sheet TEXT,
    size_bytes INT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    verdict VARCHAR(32),
    similarity FLOAT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. jobs table tracking backgournd processing status
CREATE TABLE IF NOT EXISTS jobs (
    job_id VARCHAR(64) PRIMARY KEY,
    status VARCHAR(32) NOT NULL,
    progress INT NOT NULL,
    message TEXT NOT NULL,
);