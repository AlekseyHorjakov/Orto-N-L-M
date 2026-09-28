"""Идемпотентная миграция БД Orto-N.

Приводит схему к состоянию, которое ожидает backend:
- колонка `processes.instruction_text` (готовый текст инструкции);
- таблица `test_results` (отдельная запись на каждую попытку теста);
- таблица `learned_instructions` (отметки «инструкция изучена»).

Запускается автоматически на этапе деплоя (docker exec orto-n-backend python migrate.py)
или вручную из каталога backend: python migrate.py
"""
import sys

from sqlalchemy import text

from database import engine


STATEMENTS = [
    "ALTER TABLE processes ADD COLUMN IF NOT EXISTS instruction_text TEXT",
    """
    CREATE TABLE IF NOT EXISTS test_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
        score INTEGER NOT NULL CHECK (score >= 0),
        total INTEGER NOT NULL CHECK (total > 0),
        percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_test_results_user ON test_results(user_id)",
    (
        "CREATE INDEX IF NOT EXISTS idx_test_results_process "
        "ON test_results(process_id)"
    ),
    """
    CREATE TABLE IF NOT EXISTS learned_instructions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        process_id INTEGER NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, process_id)
    )
    """,
    (
        "CREATE INDEX IF NOT EXISTS idx_learned_instructions_user "
        "ON learned_instructions(user_id)"
    ),
]


def main() -> int:
    try:
        with engine.begin() as connection:
            for statement in STATEMENTS:
                connection.execute(text(statement))

            columns = [
                row[0]
                for row in connection.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = 'processes' "
                        "ORDER BY ordinal_position"
                    )
                ).fetchall()
            ]
            tables = [
                row[0]
                for row in connection.execute(
                    text(
                        "SELECT table_name FROM information_schema.tables "
                        "WHERE table_schema = 'public'"
                    )
                ).fetchall()
            ]
            count = connection.execute(
                text("SELECT COUNT(*) FROM processes")
            ).scalar_one()
    except Exception as error:  # noqa: BLE001 - ошибка должна уронить шаг деплоя
        print(f"MIGRATION FAILED: {type(error).__name__}: {error}")
        return 1

    if "instruction_text" not in columns:
        print("MIGRATION FAILED: колонка instruction_text отсутствует после ALTER")
        return 1

    if "test_results" not in tables:
        print("MIGRATION FAILED: таблица test_results отсутствует после CREATE")
        return 1

    if "learned_instructions" not in tables:
        print(
            "MIGRATION FAILED: таблица learned_instructions отсутствует "
            "после CREATE"
        )
        return 1

    print(
        "MIGRATION OK. processes columns: "
        + ", ".join(columns)
        + "; test_results: ok"
        + "; learned_instructions: ok"
        + f"; rows: {count}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())