-- =========================================
-- Orto-N-L-M
-- Database Schema v2.0
-- =========================================

CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('manager', 'specialist', 'trainee')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    full_name VARCHAR(255),
    position_id INTEGER REFERENCES positions(id)
);

CREATE TABLE IF NOT EXISTS processes (
    id SERIAL PRIMARY KEY,
    position_id INTEGER NOT NULL REFERENCES positions(id),
    name TEXT NOT NULL,
    goal TEXT,
    process_json JSONB NOT NULL,
    instruction_text TEXT
);

-- Миграция для существующих баз: готовый текст инструкции (AI Instruction Generator).
ALTER TABLE processes ADD COLUMN IF NOT EXISTS instruction_text TEXT;

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

-- Результаты тестов стажёра (блок «Стажёр», звено «Результат»).
CREATE TABLE IF NOT EXISTS test_results (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0),
    total INTEGER NOT NULL CHECK (total > 0),
    percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_results_user
ON test_results(user_id);

CREATE INDEX IF NOT EXISTS idx_test_results_process
ON test_results(process_id);

-- Отметки «инструкция изучена» (прогресс стажёра сохраняется между сессиями).
CREATE TABLE IF NOT EXISTS learned_instructions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, process_id)
);

CREATE INDEX IF NOT EXISTS idx_learned_instructions_user
ON learned_instructions(user_id);
