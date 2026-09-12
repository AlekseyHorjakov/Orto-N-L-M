import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text

from database import engine


load_dotenv()

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


def create_access_token(user_id: int, username: str, role: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=JWT_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALGORITHM],
    )


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Недействительный или просроченный токен",
            headers={"WWW-Authenticate": "Bearer"},
        )

    with engine.connect() as connection:
        user = connection.execute(
            text(
                """
                SELECT id, username, role, is_active
                FROM users
                WHERE id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Пользователь не найден",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="Пользователь отключён",
        )

    return {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"],
    }


def require_role(*allowed_roles: str):
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Недостаточно прав",
            )

        return current_user

    return role_checker