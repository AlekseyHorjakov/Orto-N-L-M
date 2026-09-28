"""Хранение файлов (скриншотов интервью) и регистрация их в таблице files.

storage_path в таблице files хранит ИМЯ файла внутри STORAGE_DIR, чтобы путь
не зависел от абсолютного расположения каталога (локальный запуск, контейнер).
"""
import base64
import binascii
import os
import uuid

from sqlalchemy import text

from database import engine


STORAGE_DIR = os.environ.get("STORAGE_DIR") or os.path.join(
    os.path.dirname(__file__), "storage"
)

ALLOWED_MIME = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

MAX_FILE_BYTES = 10 * 1024 * 1024

INTERVIEW_SCREENSHOT = "interview_screenshot"


class StorageError(Exception):
    """Ошибка сохранения или чтения файла."""


def _ensure_storage_dir() -> None:
    os.makedirs(STORAGE_DIR, exist_ok=True)


def _decode_base64(raw_base64: str) -> bytes:
    value = (raw_base64 or "").strip()

    if value.startswith("data:"):
        value = value.split(",", 1)[1] if "," in value else ""

    try:
        payload = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError):
        raise StorageError("Некорректные данные файла")

    if not payload:
        raise StorageError("Пустой файл")

    if len(payload) > MAX_FILE_BYTES:
        raise StorageError("Файл слишком большой")

    return payload


def save_base64_file(
    raw_base64: str,
    mime_type: str | None,
    original_name: str | None = None,
    file_type: str = INTERVIEW_SCREENSHOT,
) -> dict:
    """Сохраняет файл на диск и регистрирует его в таблице files."""
    mime = (mime_type or "image/png").split(";")[0].strip().lower()

    if mime not in ALLOWED_MIME:
        raise StorageError("Недопустимый тип файла")

    payload = _decode_base64(raw_base64)
    extension = ALLOWED_MIME[mime]
    file_name = f"{uuid.uuid4().hex}.{extension}"

    _ensure_storage_dir()

    with open(os.path.join(STORAGE_DIR, file_name), "wb") as file_handle:
        file_handle.write(payload)

    stored_name = (original_name or f"screenshot.{extension}").strip()[:255]
    stored_name = stored_name or f"screenshot.{extension}"

    with engine.begin() as connection:
        row = connection.execute(
            text(
                """
                INSERT INTO files (original_name, storage_path, mime_type, file_type)
                VALUES (:original_name, :storage_path, :mime_type, :file_type)
                RETURNING id
                """
            ),
            {
                "original_name": stored_name,
                "storage_path": file_name,
                "mime_type": mime,
                "file_type": file_type,
            },
        ).mappings().one()

    return {
        "file_id": row["id"],
        "url": f"/api/files/{row['id']}",
        "mime_type": mime,
        "original_name": stored_name,
        "file_type": file_type,
    }


def get_file_row(file_id: int):
    """Возвращает запись файла из таблицы files или None."""
    with engine.connect() as connection:
        return connection.execute(
            text(
                """
                SELECT id, original_name, storage_path, mime_type, file_type
                FROM files
                WHERE id = :file_id
                """
            ),
            {"file_id": file_id},
        ).mappings().first()


def file_exists(file_id: int) -> bool:
    return get_file_row(file_id) is not None


def resolve_file_path(storage_path: str) -> str:
    if os.path.isabs(storage_path):
        return storage_path

    return os.path.join(STORAGE_DIR, storage_path)
