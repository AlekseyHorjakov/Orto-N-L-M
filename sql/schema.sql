-- =========================================
-- Orto-N-L-M
-- Database Schema v2.0
-- =========================================

CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS processes (
    id SERIAL PRIMARY KEY,
    position_id INTEGER NOT NULL REFERENCES positions(id),
    name TEXT NOT NULL,
    goal TEXT,
    process_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    original_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_sessions (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('active', 'completed', 'cancelled')),
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user
ON interview_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_status
ON interview_sessions(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_sessions_active
ON interview_sessions(user_id)
WHERE status = 'active';

CREATE TABLE IF NOT EXISTS manager_sessions (
    user_id BIGINT PRIMARY KEY,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- n8n_chat_histories создаётся n8n и используется workflow
-- для PostgreSQL Chat Memory и состояния тестирования.
