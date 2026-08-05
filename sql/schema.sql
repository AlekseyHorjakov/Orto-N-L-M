-- =========================================
-- Orto-N-L-M
-- Database Schema v1.1
-- PostgreSQL 17.6
-- =========================================

-- =========================================
-- Positions
-- =========================================

CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- =========================================
-- Business Processes
-- =========================================

CREATE TABLE processes (
    id SERIAL PRIMARY KEY,
    position_id INTEGER NOT NULL REFERENCES positions(id),
    name TEXT NOT NULL,
    goal TEXT,
    process_json JSONB NOT NULL
);

-- =========================================
-- Attached Files
-- =========================================

CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    original_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_type TEXT NOT NULL
);

-- =========================================
-- Interview Sessions
-- =========================================

CREATE TABLE interview_sessions (
    id SERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    status VARCHAR(20) NOT NULL
        CHECK (status IN ('active', 'completed')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================
-- Indexes
-- =========================================

CREATE INDEX idx_interview_sessions_user
ON interview_sessions(user_id);

CREATE INDEX idx_interview_sessions_status
ON interview_sessions(status);

-- Только одно активное интервью на пользователя

CREATE UNIQUE INDEX idx_interview_sessions_active
ON interview_sessions(user_id)
WHERE status = 'active';