import bcrypt
import json
import os
import urllib.request
import urllib.error

from dotenv import load_dotenv

from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import text

from database import engine
from auth import (
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


class InterviewRequest(BaseModel):
    message: str = ""
    history: list = []
    role: str | None = None
    position: str | None = None
    process: str | None = None
    screenshot: str | None = None
    screenshot_type: str | None = None


@app.post("/ai/interview")
def ai_interview(
    data: InterviewRequest,
    current_user: dict = Depends(
        require_role("manager", "specialist")
    ),
):
    payload = {
        "action": "interview",
        "message": data.message,
        "history": data.history,
        "role": data.role,
        "position": data.position,
        "process": data.process,
        "screenshot": data.screenshot,
        "screenshot_type": data.screenshot_type,
        "user": {
            "id": current_user["sub"],
            "username": current_user["username"],
            "role": current_user["role"],
        },
    }

    request = urllib.request.Request(
        N8N_INTERVIEW_WEBHOOK_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result

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
                SELECT id, username, full_name, password_hash, role
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
                        p.process_json
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
                        p.process_json
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
                RETURNING id, position_id, name, goal, process_json
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
    }

@app.put("/processes/{process_id}")
def update_process(
    process_id: int,
    process_data: ProcessUpdate,
    current_user: dict = Depends(require_role("manager")),
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
                SELECT id
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
                    process_json = jsonb_build_object('text', CAST(:goal AS TEXT))
                WHERE id = :process_id
                RETURNING id, position_id, name, goal, process_json
                """
            ),
            {
                "position_id": process_data.position_id,
                "name": name,
                "goal": goal,
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
    }


@app.delete("/processes/{process_id}")
def delete_process(
    process_id: int,
    current_user: dict = Depends(require_role("manager", "specialist")),
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











