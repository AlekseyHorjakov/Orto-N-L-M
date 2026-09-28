import bcrypt
import json
import os
import random
import urllib.request
import urllib.error

from dotenv import load_dotenv

from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import text

import onedrive
import storage
from database import engine
from auth import (
    authenticate_token,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
)


load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

N8N_INTERVIEW_WEBHOOK_URL = os.environ.get("N8N_INTERVIEW_WEBHOOK_URL")
if not N8N_INTERVIEW_WEBHOOK_URL:
    raise RuntimeError(
        "Ошибка конфигурации: переменная окружения "
        "N8N_INTERVIEW_WEBHOOK_URL не задана. "
        "Укажите её в backend/.env или в окружении контейнера."
    )


app = FastAPI(
    title="Orto-N-L-M API",
    version="1.0.0",
    root_path="/api",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.orto-n.ru",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    role: str
    position_id: int | None = None


class UserUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    role: str
    position_id: int | None = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


NO_KNOWLEDGE_MESSAGE = "В базе знаний не найдено информации по этому вопросу."

# Минимальный процент правильных ответов, при котором тест стажёра считается зачтённым.
TEST_PASS_PERCENT = 80

# Абсолютный максимум вопросов теста (совпадает с ограничением workflow).
TEST_MAX_QUESTIONS = 20


class InterviewRequest(BaseModel):
    message: str = ""
    history: list = []
    role: str | None = None
    position: str | None = None
    process: str | None = None
    screenshot: str | None = None
    screenshot_type: str | None = None
    screenshot_name: str | None = None
    screenshot_step: str | None = None
    attachments: list = []


class InstructionRequest(BaseModel):
    process_json: dict
    process_id: int | None = None


class QuestionRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)

class TestRequest(BaseModel):
    process_json: dict
    process_id: int | None = None


class TestResultSubmit(BaseModel):
    process_id: int
    score: int = Field(ge=0)
    total: int = Field(gt=0)


class LearnedInstructionRequest(BaseModel):
    process_id: int



def call_n8n(payload: dict, timeout: int = 120):
    """Единая точка вызова n8n webhook. Маршрутизация внутри workflow — по полю action."""
    request = urllib.request.Request(
        N8N_INTERVIEW_WEBHOOK_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise HTTPException(
            status_code=502,
            detail=f"n8n HTTP {e.code}: {detail}",
        )

    except urllib.error.URLError as e:
        raise HTTPException(
            status_code=502,
            detail=f"n8n connection error: {e.reason}",
        )


def _verified_attachments(items: list) -> list:
    """Оставляет только ссылки на реально сохранённые файлы.

    Выдуманные AI или подделанные клиентом file_id/url отбрасываются.
    """
    verified = []
    seen = set()

    for item in items or []:
        if not isinstance(item, dict):
            continue

        file_id = item.get("file_id")

        if not isinstance(file_id, int) or file_id in seen:
            continue

        try:
            if not storage.file_exists(file_id):
                continue
        except Exception:  # noqa: BLE001 - ошибка БД не должна ломать интервью
            continue

        entry = {
            "file_id": file_id,
            "url": (
                item["url"]
                if isinstance(item.get("url"), str) and item["url"].startswith("/api/files/")
                else f"/api/files/{file_id}"
            ),
            "mime_type": (
                item["mime_type"][:50]
                if isinstance(item.get("mime_type"), str)
                else "image/png"
            ),
        }

        if isinstance(item.get("step_id"), str) and item["step_id"].strip():
            entry["step_id"] = item["step_id"].strip()[:40]

        verified.append(entry)
        seen.add(file_id)

    return verified[:20]


def get_user_for_file(request: Request) -> dict:
    """Авторизация выдачи файлов: Bearer-заголовок или ?token= (для <img>)."""
    header = request.headers.get("authorization") or ""
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""

    if not token:
        token = (request.query_params.get("token") or "").strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return authenticate_token(token)


def check_process_access(process_id: int, current_user: dict) -> dict:
    """Проверяет существование процесса и права пользователя на его должность.

    Руководитель работает с процессами любой должности, специалист и стажёр —
    только со своей. Возвращает строку процесса из таблицы processes.
    """
    with engine.connect() as connection:
        process_row = connection.execute(
            text(
                """
                SELECT id, name, position_id
                FROM processes
                WHERE id = :process_id
                """
            ),
            {"process_id": process_id},
        ).mappings().first()

        if not process_row:
            raise HTTPException(status_code=404, detail="Инструкция не найдена")

        if current_user.get("role") == "manager":
            return process_row

        user_row = connection.execute(
            text(
                """
                SELECT position_id
                FROM users
                WHERE id = :user_id
                """
            ),
            {"user_id": int(current_user["sub"])},
        ).mappings().first()

    if not user_row:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    if user_row["position_id"] != process_row["position_id"]:
        raise HTTPException(
            status_code=403,
            detail="Доступны только инструкции своей должности",
        )

    return process_row


def normalize_test_questions(raw_questions) -> list:
    """Приводит вопросы AI к строгому контракту теста.

    Вопрос считается валидным, только если содержит текст, ровно четыре
    уникальных варианта ответа и ровно один правильный вариант.
    Валидные вопросы возвращаются с перемешанными вариантами ответа.
    """
    if not isinstance(raw_questions, list):
        return []

    questions = []

    for raw in raw_questions:
        if not isinstance(raw, dict):
            continue

        question_text = raw.get("question")

        if not isinstance(question_text, str) or not question_text.strip():
            continue

        options = []

        for index, raw_option in enumerate(raw.get("options") or []):
            if not isinstance(raw_option, dict):
                continue

            option_text = raw_option.get("text")

            if not isinstance(option_text, str) or not option_text.strip():
                continue

            options.append(
                {
                    "id": index + 1,
                    "text": option_text.strip(),
                    "correct": raw_option.get("correct") is True,
                }
            )

        if len(options) != 4:
            continue

        if len({option["text"].casefold() for option in options}) != 4:
            continue

        if sum(1 for option in options if option["correct"]) != 1:
            continue

        # Правильный ответ не должен стоять на фиксированной позиции:
        # варианты каждого вопроса перемешиваются независимо.
        random.shuffle(options)

        for position, option in enumerate(options, start=1):
            option["id"] = position

        question = {
            "id": len(questions) + 1,
            "question": question_text.strip(),
            "options": options,
        }

        source_step_id = raw.get("source_step_id")

        if isinstance(source_step_id, str) and source_step_id.strip():
            question["source_step_id"] = source_step_id.strip()[:40]

        questions.append(question)

        if len(questions) >= TEST_MAX_QUESTIONS:
            break

    return questions


@app.post("/ai/interview")
def ai_interview(
    data: InterviewRequest,
    current_user: dict = Depends(
        require_role("manager", "specialist")
    ),
):
    attachment_refs = _verified_attachments(data.attachments)
    stored_attachment = None

    if data.screenshot:
        try:
            stored_attachment = storage.save_base64_file(
                raw_base64=data.screenshot,
                mime_type=data.screenshot_type,
                original_name=data.screenshot_name,
            )

            if isinstance(data.screenshot_step, str) and data.screenshot_step.strip():
                stored_attachment["step_id"] = data.screenshot_step.strip()[:40]

            attachment_refs = attachment_refs + [stored_attachment]
        except storage.StorageError:
            # Интервью не должно падать из-за проблем с файлом: продолжаем без него.
            stored_attachment = None

    payload = {
        "action": "interview",
        "message": data.message,
        "history": data.history,
        "role": data.role,
        "position": data.position,
        "process": data.process,
        "screenshot": data.screenshot,
        "screenshot_type": data.screenshot_type,
        "attachments": attachment_refs,
        "user": {
            "id": current_user["sub"],
            "username": current_user["username"],
            "role": current_user["role"],
        },
    }

    result = call_n8n(payload, timeout=120)

    if stored_attachment and isinstance(result, dict):
        result["stored_attachment"] = stored_attachment

    return result


@app.post("/ai/instruction")
def ai_instruction(
    data: InstructionRequest,
    current_user: dict = Depends(
        require_role("manager", "specialist")
    ),
):
    if not data.process_json:
        raise HTTPException(
            status_code=400,
            detail="Process JSON обязателен для генерации инструкции",
        )

    payload = {
        "action": "instruction",
        "process_json": data.process_json,
        "user": {
            "id": current_user["sub"],
            "username": current_user["username"],
            "role": current_user["role"],
        },
    }

    result = call_n8n(payload, timeout=180)

    if isinstance(result, list):
        if not result:
            raise HTTPException(
                status_code=502,
                detail="n8n вернул пустой ответ",
            )
        result = result[0]

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=502,
            detail="Неожиданный формат ответа n8n",
        )

    if result.get("type") != "instruction":
        raise HTTPException(
            status_code=502,
            detail="n8n вернул ответ не для action=instruction",
        )

    instruction_text = result.get("instruction")

    if not isinstance(instruction_text, str) or not instruction_text.strip():
        raise HTTPException(
            status_code=502,
            detail="AI Instruction Generator не вернул текст инструкции",
        )

    process_json_result = result.get("process_json")

    if not isinstance(process_json_result, dict):
        process_json_result = data.process_json

    saved = False

    if data.process_id is not None:
        with engine.begin() as connection:
            process_row = connection.execute(
                text(
                    """
                    SELECT id, position_id
                    FROM processes
                    WHERE id = :process_id
                    """
                ),
                {"process_id": data.process_id},
            ).mappings().first()

            if not process_row:
                raise HTTPException(
                    status_code=404,
                    detail="Инструкция не найдена",
                )

            if current_user["role"] != "manager":
                user_row = connection.execute(
                    text(
                        """
                        SELECT position_id
                        FROM users
                        WHERE id = :user_id
                        """
                    ),
                    {"user_id": int(current_user["sub"])},
                ).mappings().first()

                if not user_row:
                    raise HTTPException(
                        status_code=401,
                        detail="Пользователь не найден",
                    )

                if user_row["position_id"] != process_row["position_id"]:
                    raise HTTPException(
                        status_code=403,
                        detail="Специалист может обновлять инструкции только на своей должности",
                    )

            connection.execute(
                text(
                    """
                    UPDATE processes
                    SET instruction_text = :instruction_text
                    WHERE id = :process_id
                    """
                ),
                {
                    "instruction_text": instruction_text,
                    "process_id": data.process_id,
                },
            )

        saved = True

    return {
        "type": "instruction",
        "instruction": instruction_text,
        "process_json": process_json_result,
        "process_id": data.process_id,
        "saved": saved,
    }


@app.post("/ai/test")
def ai_test(
    data: TestRequest,
    current_user: dict = Depends(
        require_role("manager", "specialist", "trainee")
    ),
):
    """Формирует тест по Process JSON конкретной инструкции.

    Тест строится только на данных процесса: никакой другой источник
    фактов не используется.
    """
    if not data.process_json:
        raise HTTPException(
            status_code=400,
            detail="Process JSON обязателен для генерации теста",
        )

    if data.process_id is not None:
        check_process_access(data.process_id, current_user)

    payload = {
        "action": "test",
        "process_json": data.process_json,
        "user": {
            "id": current_user["sub"],
            "username": current_user["username"],
            "role": current_user["role"],
        },
    }

    result = call_n8n(payload, timeout=180)

    if isinstance(result, list):
        if not result:
            raise HTTPException(
                status_code=502,
                detail="n8n вернул пустой ответ",
            )
        result = result[0]

    if not isinstance(result, dict) or result.get("type") != "test":
        raise HTTPException(
            status_code=502,
            detail="n8n вернул ответ не для action=test",
        )

    questions = normalize_test_questions(result.get("questions"))

    if not questions:
        ai_error = result.get("error")

        raise HTTPException(
            status_code=502,
            detail=(
                ai_error.strip()
                if isinstance(ai_error, str) and ai_error.strip()
                else "AI не сформировал ни одного корректного вопроса теста"
            ),
        )

    test_title = result.get("test_title")

    return {
        "type": "test",
        "test_title": (
            test_title.strip()
            if isinstance(test_title, str) and test_title.strip()
            else "Проверка знаний"
        ),
        "questions": questions,
        "process_id": data.process_id,
        "pass_percent": TEST_PASS_PERCENT,
    }


@app.post("/test-results")
def save_test_result(
    data: TestResultSubmit,
    current_user: dict = Depends(
        require_role("manager", "specialist", "trainee")
    ),
):
    """Сохраняет результат пройденного теста стажёра."""
    if data.score > data.total:
        raise HTTPException(
            status_code=400,
            detail=(
                "Количество правильных ответов не может превышать "
                "число вопросов"
            ),
        )

    check_process_access(data.process_id, current_user)

    percent = round(data.score / data.total * 100)

    with engine.begin() as connection:
        row = connection.execute(
            text(
                """
                INSERT INTO test_results (
                    user_id,
                    process_id,
                    score,
                    total,
                    percent
                )
                VALUES (
                    :user_id,
                    :process_id,
                    :score,
                    :total,
                    :percent
                )
                RETURNING id, score, total, percent, created_at
                """
            ),
            {
                "user_id": int(current_user["sub"]),
                "process_id": data.process_id,
                "score": data.score,
                "total": data.total,
                "percent": percent,
            },
        ).mappings().one()

    return {
        "id": row["id"],
        "process_id": data.process_id,
        "score": row["score"],
        "total": row["total"],
        "percent": row["percent"],
        "passed": row["percent"] >= TEST_PASS_PERCENT,
        "pass_percent": TEST_PASS_PERCENT,
        "created_at": row["created_at"].isoformat(),
    }


@app.get("/test-results")
def get_test_results(
    current_user: dict = Depends(get_current_user),
):
    """Возвращает прогресс текущего пользователя.

    Для каждого процесса отдаётся лучшая попытка (процент, правильные ответы,
    число вопросов, число попыток, дата) и список изученных инструкций.
    """
    user_id = int(current_user["sub"])

    with engine.connect() as connection:
        rows = connection.execute(
            text(
                """
                WITH ranked AS (
                    SELECT
                        process_id,
                        percent,
                        score,
                        total,
                        created_at,
                        ROW_NUMBER() OVER (
                            PARTITION BY process_id
                            ORDER BY percent DESC, created_at DESC, id DESC
                        ) AS place,
                        COUNT(*) OVER (PARTITION BY process_id) AS attempts
                    FROM test_results
                    WHERE user_id = :user_id
                )
                SELECT
                    process_id,
                    percent AS best_percent,
                    score AS best_score,
                    total AS best_total,
                    created_at AS last_at,
                    attempts
                FROM ranked
                WHERE place = 1
                ORDER BY process_id
                """
            ),
            {"user_id": user_id},
        ).mappings().all()

        learned_rows = connection.execute(
            text(
                """
                SELECT process_id
                FROM learned_instructions
                WHERE user_id = :user_id
                ORDER BY process_id
                """
            ),
            {"user_id": user_id},
        ).fetchall()

    return {
        "pass_percent": TEST_PASS_PERCENT,
        "results": [
            {
                "process_id": row["process_id"],
                "best_percent": row["best_percent"],
                "best_score": row["best_score"],
                "best_total": row["best_total"],
                "attempts": row["attempts"],
                "passed": row["best_percent"] >= TEST_PASS_PERCENT,
                "last_at": row["last_at"].isoformat() if row["last_at"] else None,
            }
            for row in rows
        ],
        "learned_process_ids": [row[0] for row in learned_rows],
    }


@app.post("/learned-instructions")
def mark_instruction_learned(
    data: LearnedInstructionRequest,
    current_user: dict = Depends(
        require_role("manager", "specialist", "trainee")
    ),
):
    """Отмечает инструкцию как изученную текущим пользователем."""
    check_process_access(data.process_id, current_user)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO learned_instructions (user_id, process_id)
                VALUES (:user_id, :process_id)
                ON CONFLICT (user_id, process_id) DO NOTHING
                """
            ),
            {
                "user_id": int(current_user["sub"]),
                "process_id": data.process_id,
            },
        )

    return {"process_id": data.process_id, "learned": True}


@app.delete("/learned-instructions/{process_id}")
def unmark_instruction_learned(
    process_id: int,
    current_user: dict = Depends(
        require_role("manager", "specialist", "trainee")
    ),
):
    """Снимает отметку «изучено» у инструкции текущего пользователя."""
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                DELETE FROM learned_instructions
                WHERE user_id = :user_id
                  AND process_id = :process_id
                """
            ),
            {
                "user_id": int(current_user["sub"]),
                "process_id": process_id,
            },
        )

    return {"process_id": process_id, "learned": False}


@app.get("/manager/test-results")
def get_manager_test_results(
    user_id: int | None = None,
    position_id: int | None = None,
    current_user: dict = Depends(require_role("manager")),
):
    """Журнал всех попыток тестирования сотрудников (только руководитель).

    Фильтры по сотруднику и должности применяются совместно.
    """
    filters = []
    params: dict = {}

    if user_id is not None:
        filters.append("tr.user_id = :user_id")
        params["user_id"] = user_id

    if position_id is not None:
        filters.append("pos.id = :position_id")
        params["position_id"] = position_id

    where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""

    query = text(
        f"""
        SELECT
            tr.id,
            tr.percent,
            tr.score,
            tr.total,
            tr.created_at,
            u.id AS user_id,
            u.full_name,
            u.username,
            pos.id AS position_id,
            pos.name AS position_name,
            p.id AS process_id,
            p.name AS process_name
        FROM test_results tr
        JOIN users u ON u.id = tr.user_id
        JOIN processes p ON p.id = tr.process_id
        JOIN positions pos ON pos.id = p.position_id
        {where_clause}
        ORDER BY tr.created_at DESC, tr.id DESC
        """
    )

    with engine.connect() as connection:
        rows = connection.execute(query, params).mappings().all()

    return {
        "pass_percent": TEST_PASS_PERCENT,
        "results": [
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "full_name": row["full_name"] or row["username"],
                "username": row["username"],
                "position_id": row["position_id"],
                "position_name": row["position_name"],
                "process_id": row["process_id"],
                "process_name": row["process_name"],
                "score": row["score"],
                "total": row["total"],
                "percent": row["percent"],
                "passed": row["percent"] >= TEST_PASS_PERCENT,
                "created_at": (
                    row["created_at"].isoformat() if row["created_at"] else None
                ),
            }
            for row in rows
        ],
    }


@app.get("/files/{file_id}")
def get_file(
    file_id: int,
    current_user: dict = Depends(get_user_for_file),
):
    row = storage.get_file_row(file_id)

    if not row:
        raise HTTPException(status_code=404, detail="Файл не найден")

    path = storage.resolve_file_path(row["storage_path"])

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Файл не найден на диске")

    return FileResponse(path, media_type=row["mime_type"])


@app.post("/ai/question")
def ai_question(
    data: QuestionRequest,
    current_user: dict = Depends(
        require_role("manager", "specialist", "trainee")
    ),
):
    question = data.question.strip()

    try:
        documents = onedrive.search_documents(question)
    except onedrive.OneDriveNotConfigured:
        return {
            "type": "question",
            "status": "unavailable",
            "answer": (
                "Поиск по базе знаний пока не настроен. "
                "Обратитесь к руководителю."
            ),
            "sources": [],
        }
    except onedrive.OneDriveError as error:
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка поиска в базе знаний: {error}",
        )

    documents = [
        document
        for document in documents
        if document.get("name") or document.get("fragment")
    ]

    if not documents:
        # AI НЕ вызывается: отвечать не из чего.
        return {
            "type": "question",
            "status": "not_found",
            "answer": NO_KNOWLEDGE_MESSAGE,
            "sources": [],
        }

    payload = {
        "action": "question",
        "question": question,
        "context": documents,
        "user": {
            "id": current_user["sub"],
            "username": current_user["username"],
            "role": current_user["role"],
        },
    }

    result = call_n8n(payload, timeout=120)

    if isinstance(result, list):
        result = result[0] if result else None

    if not isinstance(result, dict) or result.get("type") != "question":
        raise HTTPException(
            status_code=502,
            detail="n8n вернул ответ не для action=question",
        )

    answer = result.get("answer")

    if not isinstance(answer, str) or not answer.strip():
        raise HTTPException(
            status_code=502,
            detail="AI не вернул ответ на вопрос",
        )

    sources = result.get("sources")

    if not isinstance(sources, list):
        sources = [
            {
                "name": document.get("name") or "",
                "url": document.get("url") or "",
                "fragment": document.get("fragment") or "",
            }
            for document in documents
        ]

    return {
        "type": "question",
        "status": result.get("status") or "answered",
        "answer": answer.strip(),
        "sources": sources,
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "orto-n-l-m-backend",
    }


@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    with engine.connect() as connection:
        user = connection.execute(
            text(
                """
                SELECT id, username, full_name, password_hash, role, position_id
                FROM users
                WHERE username = :username
                  AND is_active = TRUE
                """
            ),
            {"username": form_data.username},
        ).mappings().first()

    if not user or not verify_password(
        form_data.password,
        user["password_hash"],
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверный логин или пароль",
        )

    access_token = create_access_token(
        user_id=user["id"],
        username=user["username"],
        role=user["role"],
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "position_id": user["position_id"],
        },
    }


@app.get("/positions")
def get_positions(
    current_user: dict = Depends(get_current_user),
):
    with engine.connect() as connection:
        positions = connection.execute(
            text(
                """
                SELECT id, name
                FROM positions
                ORDER BY id
                """
            )
        ).mappings().all()

    return [
        {
            "id": position["id"],
            "name": position["name"],
        }
        for position in positions
    ]


@app.get("/users")
def get_users(
    current_user: dict = Depends(require_role("manager")),
):
    with engine.connect() as connection:
        users = connection.execute(
            text(
                """
                SELECT
                    id,
                    username,
                    full_name,
                    role,
                    position_id,
                    is_active,
                    created_at
                FROM users
                ORDER BY id
                """
            )
        ).mappings().all()

    return [
        {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "position_id": user["position_id"],
            "is_active": user["is_active"],
            "created_at": user["created_at"],
        }
        for user in users
    ]


@app.post("/users")
def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(require_role("manager")),
):
    username = user_data.username.strip()
    full_name = user_data.full_name.strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Логин не может быть пустым",
        )

    if not full_name:
        raise HTTPException(
            status_code=400,
            detail="ФИО не может быть пустым",
        )

    if user_data.role not in {"manager", "specialist", "trainee"}:
        raise HTTPException(
            status_code=400,
            detail="Недопустимая роль",
        )

    with engine.connect() as connection:
        existing_user = connection.execute(
            text(
                """
                SELECT id
                FROM users
                WHERE username = :username
                """
            ),
            {"username": username},
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="Пользователь с таким логином уже существует",
            )

        if user_data.role == "manager":
            manager_count = connection.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM users
                    WHERE role = 'manager'
                      AND is_active = TRUE
                    """
                )
            ).scalar_one()

            if manager_count >= 2:
                raise HTTPException(
                    status_code=400,
                    detail="В системе уже есть два руководителя",
                )

        password_hash = bcrypt.hashpw(
            user_data.password.encode("utf-8"),
            bcrypt.gensalt(),
        ).decode("utf-8")

        connection.execute(
            text(
                """
                INSERT INTO users (
                    username,
                    full_name,
                    password_hash,
                    role,
                    position_id
                )
                VALUES (
                    :username,
                    :full_name,
                    :password_hash,
                    :role,
                    :position_id
                )
                """
            ),
            {
                "username": username,
                "full_name": full_name,
                "password_hash": password_hash,
                "role": user_data.role,
                "position_id": user_data.position_id,
            },
        )

        connection.commit()

        created_user = connection.execute(
            text(
                """
                SELECT
                    id,
                    username,
                    full_name,
                    role,
                    position_id,
                    is_active,
                    created_at
                FROM users
                WHERE username = :username
                """
            ),
            {"username": username},
        ).mappings().first()

    return {
        "id": created_user["id"],
        "username": created_user["username"],
        "full_name": created_user["full_name"],
        "role": created_user["role"],
        "position_id": created_user["position_id"],
        "is_active": created_user["is_active"],
        "created_at": created_user["created_at"],
    }


@app.put("/users/{user_id}")
def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: dict = Depends(require_role("manager")),
):
    full_name = user_data.full_name.strip()

    if not full_name:
        raise HTTPException(status_code=400, detail="ФИО не может быть пустым")

    if user_data.role not in {"manager", "specialist", "trainee"}:
        raise HTTPException(status_code=400, detail="Недопустимая роль")

    with engine.begin() as connection:
        user = connection.execute(
            text(
                """
                SELECT id, username, full_name, role, is_active, created_at
                FROM users
                WHERE id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().first()

        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        if user_id == int(current_user["sub"]) and user_data.role != "manager":
            raise HTTPException(
                status_code=400,
                detail="Руководитель не может снять роль руководителя у себя",
            )

        if user["role"] != "manager" and user_data.role == "manager":
            manager_count = connection.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM users
                    WHERE role = 'manager' AND is_active = TRUE
                    """
                )
            ).scalar_one()

            if manager_count >= 2:
                raise HTTPException(
                    status_code=400,
                    detail="В системе уже есть два руководителя",
                )

        if user["role"] == "manager" and user_data.role != "manager":
            manager_count = connection.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM users
                    WHERE role = 'manager' AND is_active = TRUE
                    """
                )
            ).scalar_one()

            if user["is_active"] and manager_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Нельзя убрать роль у единственного руководителя",
                )

        updated_user = connection.execute(
            text(
                """
                UPDATE users
                SET full_name = :full_name,
                    role = :role,
                    position_id = :position_id
                WHERE id = :user_id
                RETURNING id, username, full_name, role, position_id, is_active, created_at
                """
            ),
            {
                "user_id": user_id,
                "full_name": full_name,
                "role": user_data.role,
                "position_id": user_data.position_id,
            },
        ).mappings().one()

    return dict(updated_user)


@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: dict = Depends(require_role("manager")),
):
    if user_id == int(current_user["sub"]):
        raise HTTPException(
            status_code=400,
            detail="Нельзя удалить собственную учётную запись",
        )

    with engine.begin() as connection:
        user = connection.execute(
            text(
                """
                SELECT id, username, full_name, role, position_id, is_active
                FROM users
                WHERE id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().first()

        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        if user["role"] == "manager" and user["is_active"]:
            manager_count = connection.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM users
                    WHERE role = 'manager' AND is_active = TRUE
                    """
                )
            ).scalar_one()

            if manager_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Нельзя удалить единственного руководителя",
                )

        connection.execute(
            text("DELETE FROM users WHERE id = :user_id"),
            {"user_id": user_id},
        )

    return {"status": "ok", "id": user["id"]}


@app.get("/auth/me")
def get_me(
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"])

    with engine.connect() as connection:
        user = connection.execute(
            text(
                """
                SELECT id, username, full_name, role, position_id, is_active
                FROM users
                WHERE id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Пользователь не найден",
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="Пользователь отключён",
        )

    return {
        "id": user["id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "role": user["role"],
        "position_id": user["position_id"],
    }



class PositionUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)

class ProcessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    position_id: int
    goal: str = Field(min_length=1)
    process_json: dict | None = None


class ProcessUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    position_id: int
    goal: str = Field(min_length=1)
    instruction_text: str | None = None


@app.get("/processes")
def get_processes(
    position_id: int | None = None,
    current_user: dict = Depends(get_current_user),
):
    with engine.connect() as connection:
        if position_id is not None:
            processes = connection.execute(
                text(
                    """
                    SELECT
                        p.id,
                        p.name,
                        p.position_id,
                        pos.name AS position_name,
                        p.goal,
                        p.process_json,
                        p.instruction_text
                    FROM processes p
                    JOIN positions pos ON pos.id = p.position_id
                    WHERE p.position_id = :position_id
                    ORDER BY p.id
                    """
                ),
                {"position_id": position_id},
            ).mappings().all()
        else:
            processes = connection.execute(
                text(
                    """
                    SELECT
                        p.id,
                        p.name,
                        p.position_id,
                        pos.name AS position_name,
                        p.goal,
                        p.process_json,
                        p.instruction_text
                    FROM processes p
                    JOIN positions pos ON pos.id = p.position_id
                    ORDER BY p.id
                    """
                )
            ).mappings().all()

    return [
        {
            "id": item["id"],
            "title": item["name"],
            "position_id": item["position_id"],
            "position": item["position_name"],
            "text": item["goal"] or "",
            "process_json": item["process_json"],
            "instruction_text": item["instruction_text"],
        }
        for item in processes
    ]


@app.post("/processes")
def create_process(
    process_data: ProcessCreate,
    current_user: dict = Depends(require_role("manager", "specialist")),
):
    name = process_data.name.strip()
    goal = process_data.goal.strip()

    if not name or not goal:
        raise HTTPException(
            status_code=400,
            detail="Название и текст инструкции не могут быть пустыми",
        )

    with engine.begin() as connection:
        user_row = connection.execute(
            text(
                """
                SELECT role, position_id
                FROM users
                WHERE id = :user_id
                """
            ),
            {"user_id": int(current_user["sub"])},
        ).mappings().first()

        if not user_row:
            raise HTTPException(
                status_code=401,
                detail="Пользователь не найден",
            )

        if user_row["role"] != "manager" and user_row["position_id"] != process_data.position_id:
            raise HTTPException(
                status_code=403,
                detail="Специалист может сохранять инструкции только на свою должность",
            )

        position = connection.execute(
            text("""
                SELECT id, name
                FROM positions
                WHERE id = :position_id
            """),
            {"position_id": process_data.position_id},
        ).mappings().first()

        if not position:
            raise HTTPException(status_code=404, detail="Должность не найдена")

        duplicate = connection.execute(
            text("""
                SELECT id
                FROM processes
                WHERE position_id = :position_id
                  AND LOWER(name) = LOWER(:name)
            """),
            {
                "position_id": process_data.position_id,
                "name": name,
            },
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Инструкция с таким названием для этой должности уже существует",
            )

        process_json_value = (
            json.dumps(process_data.process_json, ensure_ascii=False)
            if process_data.process_json is not None
            else None
        )

        row = connection.execute(
            text("""
                INSERT INTO processes (
                    position_id,
                    name,
                    goal,
                    process_json
                )
                VALUES (
                    :position_id,
                    :name,
                    :goal,
                    COALESCE(
                        CAST(:process_json AS jsonb),
                        jsonb_build_object('text', CAST(:goal AS TEXT))
                    )
                )
                RETURNING id, position_id, name, goal, process_json, instruction_text
            """),
            {
                "position_id": process_data.position_id,
                "name": name,
                "goal": goal,
                "process_json": process_json_value,
            },
        ).mappings().one()
    return {
        "id": row["id"],
        "title": row["name"],
        "position_id": row["position_id"],
        "position": position["name"],
        "text": row["goal"] or "",
        "process_json": row["process_json"],
        "instruction_text": row["instruction_text"],
    }

@app.put("/processes/{process_id}")
def update_process(
    process_id: int,
    process_data: ProcessUpdate,
    current_user: dict = Depends(require_role("manager", "specialist")),
):
    name = process_data.name.strip()
    goal = process_data.goal.strip()

    if not name or not goal:
        raise HTTPException(
            status_code=400,
            detail="Название и текст инструкции не могут быть пустыми",
        )

    with engine.begin() as connection:
        process = connection.execute(
            text(
                """
                SELECT id, position_id
                FROM processes
                WHERE id = :process_id
                """
            ),
            {"process_id": process_id},
        ).mappings().first()

        if not process:
            raise HTTPException(
                status_code=404,
                detail="Инструкция не найдена",
            )

        if current_user["role"] != "manager":
            user_row = connection.execute(
                text(
                    """
                    SELECT position_id
                    FROM users
                    WHERE id = :user_id
                    """
                ),
                {"user_id": int(current_user["sub"])},
            ).mappings().first()

            if not user_row:
                raise HTTPException(
                    status_code=401,
                    detail="Пользователь не найден",
                )

            if user_row["position_id"] != process["position_id"]:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Специалист может изменять инструкции "
                        "только на своей должности"
                    ),
                )

            if process_data.position_id != process["position_id"]:
                raise HTTPException(
                    status_code=403,
                    detail="Нельзя перенести инструкцию на другую должность",
                )

        position = connection.execute(
            text(
                """
                SELECT id, name
                FROM positions
                WHERE id = :position_id
                """
            ),
            {"position_id": process_data.position_id},
        ).mappings().first()

        if not position:
            raise HTTPException(
                status_code=404,
                detail="Должность не найдена",
            )

        duplicate = connection.execute(
            text(
                """
                SELECT id
                FROM processes
                WHERE position_id = :position_id
                  AND LOWER(name) = LOWER(:name)
                  AND id <> :process_id
                """
            ),
            {
                "position_id": process_data.position_id,
                "name": name,
                "process_id": process_id,
            },
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Такая инструкция для этой должности уже существует",
            )

        updated = connection.execute(
            text(
                """
                UPDATE processes
                SET
                    position_id = :position_id,
                    name = :name,
                    goal = :goal,
                    instruction_text = COALESCE(:instruction_text, instruction_text)
                WHERE id = :process_id
                RETURNING id, position_id, name, goal, process_json, instruction_text
                """
            ),
            {
                "position_id": process_data.position_id,
                "name": name,
                "goal": goal,
                "instruction_text": (
                    process_data.instruction_text.strip()
                    if isinstance(process_data.instruction_text, str)
                    and process_data.instruction_text.strip()
                    else None
                ),
                "process_id": process_id,
            },
        ).mappings().one()

    return {
        "id": updated["id"],
        "title": updated["name"],
        "position_id": updated["position_id"],
        "position": position["name"],
        "text": updated["goal"],
        "process_json": updated["process_json"],
        "instruction_text": updated["instruction_text"],
    }


@app.delete("/processes/{process_id}/instruction")
def delete_instruction(
    process_id: int,
    current_user: dict = Depends(require_role("manager", "specialist")),
):
    """Полностью удаляет контур инструкции: процесс (вместе с process_json и
    instruction_text), его шаги и связанные скриншоты, на которые не ссылается
    ни один другой процесс. Должность, пользователи и другие инструкции
    не затрагиваются."""
    with engine.begin() as connection:
        process = connection.execute(
            text(
                """
                SELECT id, position_id, process_json
                FROM processes
                WHERE id = :process_id
                """
            ),
            {"process_id": process_id},
        ).mappings().first()

        if not process:
            raise HTTPException(
                status_code=404,
                detail="Инструкция не найдена",
            )

        if current_user["role"] != "manager":
            user_row = connection.execute(
                text(
                    """
                    SELECT position_id
                    FROM users
                    WHERE id = :user_id
                    """
                ),
                {"user_id": int(current_user["sub"])},
            ).mappings().first()

            if not user_row:
                raise HTTPException(
                    status_code=401,
                    detail="Пользователь не найден",
                )

            if user_row["position_id"] != process["position_id"]:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Специалист может удалять инструкции "
                        "только на своей должности"
                    ),
                )

        # 1. Собираем file_id всех вложений (скриншотов) этого процесса.
        process_json = process["process_json"]
        file_ids: list[int] = []

        if isinstance(process_json, dict):
            for step in process_json.get("steps") or []:
                if not isinstance(step, dict) or not isinstance(step.get("attachments"), list):
                    continue

                for attachment in step["attachments"]:
                    file_id = attachment.get("file_id") if isinstance(attachment, dict) else None

                    if isinstance(file_id, int) and file_id not in file_ids:
                        file_ids.append(file_id)

        # 2. Удаляем файлы, на которые не ссылается ни один другой процесс
        #    (сначала из таблицы files, затем с диска).
        deleted_files = 0

        for file_id in file_ids:
            used_elsewhere = connection.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM processes p,
                             jsonb_array_elements(
                                 COALESCE(p.process_json->'steps', '[]'::jsonb)
                             ) AS step,
                             jsonb_array_elements(
                                 COALESCE(step->'attachments', '[]'::jsonb)
                             ) AS attachment
                        WHERE p.id <> :process_id
                          AND attachment->>'file_id' ~ '^[0-9]+$'
                          AND (attachment->>'file_id')::int = :file_id
                    )
                    """
                ),
                {"process_id": process_id, "file_id": file_id},
            ).scalar()

            if used_elsewhere:
                continue

            row = connection.execute(
                text(
                    """
                    DELETE FROM files
                    WHERE id = :file_id
                    RETURNING storage_path
                    """
                ),
                {"file_id": file_id},
            ).first()

            if row:
                deleted_files += 1

                try:
                    path = storage.resolve_file_path(row[0])
                    if os.path.exists(path):
                        os.remove(path)
                except OSError:
                    pass  # файл на диске уже отсутствует — не ломаем удаление

        # 3. Удаляем сам процесс: строка в processes целиком уходит вместе с
        #    instruction_text, process_json, названием, целью и шагами.
        deleted = connection.execute(
            text(
                """
                DELETE FROM processes
                WHERE id = :process_id
                RETURNING id, name
                """
            ),
            {"process_id": process_id},
        ).mappings().one()

    return {
        "status": "ok",
        "id": deleted["id"],
        "title": deleted["name"],
        "deleted": True,
        "deleted_files": deleted_files,
        "message": (
            "Инструкция полностью удалена вместе с процессом. "
            "Можно создать её заново по той же теме."
        ),
    }


@app.delete("/processes/{process_id}")
def delete_process(
    process_id: int,
    current_user: dict = Depends(require_role("manager")),
):
    with engine.begin() as connection:
        process = connection.execute(
            text(
                """
                SELECT id, name
                FROM processes
                WHERE id = :process_id
                """
            ),
            {"process_id": process_id},
        ).mappings().first()

        if not process:
            raise HTTPException(
                status_code=404,
                detail="Инструкция не найдена",
            )

        connection.execute(
            text(
                """
                DELETE FROM processes
                WHERE id = :process_id
                """
            ),
            {"process_id": process_id},
        )

    return {
        "status": "ok",
        "message": "Инструкция удалена",
        "id": process["id"],
        "title": process["name"],
    }


@app.post("/positions")
def create_position(
    position_data: PositionUpdate,
    current_user: dict = Depends(require_role("manager")),
): 
    name = position_data.name.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Название должности не может быть пустым")

    with engine.begin() as connection:
        duplicate = connection.execute(
            text("SELECT id FROM positions WHERE LOWER(name) = LOWER(:name)"),
            {"name": name},
        ).mappings().first()

        if duplicate:
            raise HTTPException(status_code=409, detail="Такая должность уже существует")

        position = connection.execute(
            text("INSERT INTO positions (name) VALUES (:name) RETURNING id, name"),
            {"name": name},
        ).mappings().one()

    return {"id": position["id"], "name": position["name"]}

@app.put("/positions/{position_id}")
def update_position(
    position_id: int,
    position_data: PositionUpdate,
    current_user: dict = Depends(require_role("manager")),
):
    name = position_data.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Название должности не может быть пустым",
        )

    with engine.connect() as connection:
        position = connection.execute(
            text(
                """
                SELECT id, name
                FROM positions
                WHERE id = :position_id
                """
            ),
            {"position_id": position_id},
        ).mappings().first()

        if not position:
            raise HTTPException(
                status_code=404,
                detail="Должность не найдена",
            )

        duplicate = connection.execute(
            text(
                """
                SELECT id
                FROM positions
                WHERE LOWER(name) = LOWER(:name)
                  AND id <> :position_id
                """
            ),
            {
                "name": name,
                "position_id": position_id,
            },
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Такая должность уже существует",
            )

        updated = connection.execute(
            text(
                """
                UPDATE positions
                SET name = :name
                WHERE id = :position_id
                RETURNING id, name
                """
            ),
            {
                "name": name,
                "position_id": position_id,
            },
        ).mappings().first()

        connection.commit()

    return {
        "id": updated["id"],
        "name": updated["name"],
    }


@app.delete("/positions/{position_id}")
def delete_position(
    position_id: int,
    current_user: dict = Depends(require_role("manager")),
):
    with engine.connect() as connection:
        position = connection.execute(
            text(
                """
                SELECT id, name
                FROM positions
                WHERE id = :position_id
                """
            ),
            {"position_id": position_id},
        ).mappings().first()

        if not position:
            raise HTTPException(
                status_code=404,
                detail="Должность не найдена",
            )

        connection.execute(
            text(
                """
                DELETE FROM processes
                WHERE position_id = :position_id
                """
            ),
            {"position_id": position_id},
        )

        connection.execute(
            text(
                """
                DELETE FROM positions
                WHERE id = :position_id
                """
            ),
            {"position_id": position_id},
        )

        connection.commit()

    return {
        "status": "ok",
        "message": "Должность удалена",
        "id": position["id"],
        "name": position["name"],
    }

@app.get("/manager-test")
def manager_test(
    current_user: dict = Depends(require_role("manager")),
):
    return {
        "status": "ok",
        "message": "Доступ разрешён",
        "user": current_user["username"],
        "role": current_user["role"],
    }


@app.get("/specialist-test")
def specialist_test(
    current_user: dict = Depends(
        require_role("manager", "specialist")
    ),
):
    return {
        "status": "ok",
        "message": "Доступ разрешён",
        "user": current_user["username"],
        "role": current_user["role"],
    }


@app.post("/auth/change-password")
def change_password(
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["sub"])

    with engine.connect() as connection:
        user = connection.execute(
            text(
                """
                SELECT id, password_hash
                FROM users
                WHERE id = :user_id
                  AND is_active = TRUE
                """
            ),
            {"user_id": user_id},
        ).mappings().first()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="Пользователь не найден",
            )

        if not verify_password(
            password_data.current_password,
            user["password_hash"],
        ):
            raise HTTPException(
                status_code=400,
                detail="Текущий пароль указан неверно",
            )

        new_password_hash = bcrypt.hashpw(
            password_data.new_password.encode("utf-8"),
            bcrypt.gensalt(),
        ).decode("utf-8")

        connection.execute(
            text(
                """
                UPDATE users
                SET password_hash = :password_hash
                WHERE id = :user_id
                """
            ),
            {
                "password_hash": new_password_hash,
                "user_id": user_id,
            },
        )

        connection.commit()

    return {
        "status": "ok",
        "message": "Пароль успешно изменён",
    }











