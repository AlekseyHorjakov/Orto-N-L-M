CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE processes (
    id SERIAL PRIMARY KEY,
    position_id INTEGER NOT NULL REFERENCES positions(id),
    name TEXT NOT NULL,
    goal TEXT,
    process_json JSONB NOT NULL
);

CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    original_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_type TEXT NOT NULL
);