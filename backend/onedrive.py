"""Адаптер поиска по базе знаний OneDrive (Microsoft Graph API).

Режимы (переменная окружения ONEDRIVE_MODE):

- graph — реальный поиск через Microsoft Graph API. Требуются:
    MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET,
    MS_GRAPH_DRIVE_ID (идентификатор диска OneDrive/SharePoint).
- mock — локальный набор документов (backend/onedrive_mock.json), только для
    локальной отладки и проверок. Включается явно и никогда не подменяет
    реальный Graph автоматически.
- off — поиск отключён.

Если выбран режим graph, а credentials не заданы, поиск возвращает
OneDriveNotConfigured: mock вместо реального OneDrive не используется.
"""
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request


MODE = (os.environ.get("ONEDRIVE_MODE") or "graph").strip().lower()

GRAPH_TENANT_ID = os.environ.get("MS_GRAPH_TENANT_ID")
GRAPH_CLIENT_ID = os.environ.get("MS_GRAPH_CLIENT_ID")
GRAPH_CLIENT_SECRET = os.environ.get("MS_GRAPH_CLIENT_SECRET")
GRAPH_DRIVE_ID = os.environ.get("MS_GRAPH_DRIVE_ID")

MOCK_FILE = os.environ.get("ONEDRIVE_MOCK_PATH") or os.path.join(
    os.path.dirname(__file__), "onedrive_mock.json"
)

TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
GRAPH_ROOT = "https://graph.microsoft.com/v1.0"

MAX_FRAGMENT_LENGTH = 700
MAX_TEXT_DOWNLOAD = 20000


class OneDriveError(Exception):
    """Ошибка обращения к базе знаний."""


class OneDriveNotConfigured(OneDriveError):
    """Интеграция с OneDrive ещё не настроена (нет credentials)."""


def _tokenize(value: str) -> list:
    return [
        token
        for token in re.findall(r"[0-9a-zA-Zа-яА-ЯёЁ]{4,}", (value or "").lower())
    ]


def _fragment_around(text_value: str, tokens: list) -> str:
    if not text_value:
        return ""

    lowered = text_value.lower()

    for token in tokens:
        position = lowered.find(token)

        if position >= 0:
            start = max(0, position - 120)
            return text_value[start:start + MAX_FRAGMENT_LENGTH].strip()

    return text_value[:MAX_FRAGMENT_LENGTH].strip()


def _mock_documents() -> list:
    try:
        with open(MOCK_FILE, "r", encoding="utf-8") as file_handle:
            data = json.load(file_handle)
    except (OSError, ValueError) as error:
        raise OneDriveError("Не удалось прочитать mock-базу знаний") from error

    documents = data.get("documents") if isinstance(data, dict) else data

    return documents if isinstance(documents, list) else []


def _search_mock(query: str, limit: int) -> list:
    tokens = _tokenize(query)

    if not tokens:
        return []

    results = []

    for document in _mock_documents():
        if not isinstance(document, dict):
            continue

        content = document.get("content") or ""
        haystack = f"{document.get('name', '')} {content}".lower()
        matched = [token for token in tokens if token in haystack]

        if not matched:
            continue

        results.append(
            {
                "name": document.get("name") or "",
                "url": document.get("url") or "",
                "fragment": _fragment_around(content, matched),
                "score": len(set(matched)),
            }
        )



def _graph_access_token() -> str:
    if not (GRAPH_TENANT_ID and GRAPH_CLIENT_ID and GRAPH_CLIENT_SECRET):
        raise OneDriveNotConfigured(
            "Интеграция с OneDrive не настроена: задайте ONEDRIVE_MODE и "
            "MS_GRAPH_TENANT_ID / MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET."
        )

    body = urllib.parse.urlencode(
        {
            "client_id": GRAPH_CLIENT_ID,
            "client_secret": GRAPH_CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        TOKEN_URL.format(tenant=GRAPH_TENANT_ID),
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError) as error:
        raise OneDriveError(f"Не удалось получить токен Microsoft Graph: {error}")

    token = payload.get("access_token")

    if not token:
        raise OneDriveError("Microsoft Graph не вернул access_token")

    return token


def _graph_download_text(token: str, drive_id: str, item_id: str, size: int) -> str:
    if not item_id:
        return ""

    if size and size > 5 * 1024 * 1024:
        return ""

    request = urllib.request.Request(
        f"{GRAPH_ROOT}/drives/{drive_id}/items/{item_id}/content",
        headers={"Authorization": f"Bearer {token}"},
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read(MAX_TEXT_DOWNLOAD)
    except (urllib.error.HTTPError, urllib.error.URLError):
        return ""

    return raw.decode("utf-8", errors="replace")


def _search_graph(query: str, limit: int) -> list:
    if not GRAPH_DRIVE_ID:
        raise OneDriveNotConfigured(
            "Интеграция с OneDrive не настроена: задайте MS_GRAPH_DRIVE_ID."
        )

    token = _graph_access_token()
    quoted = urllib.parse.quote(query)
    url = (
        f"{GRAPH_ROOT}/drives/{GRAPH_DRIVE_ID}/root/search(q='{quoted}')"
        f"?$top={limit}"
    )

    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError) as error:
        raise OneDriveError(f"Ошибка поиска в OneDrive: {error}")

    tokens = _tokenize(query)
    results = []

    for item in payload.get("value", []):
        if not isinstance(item, dict):
            continue

        name = item.get("name") or ""
        mime = (item.get("mimeType") or "").lower()
        fragment = ""

        if mime.startswith("text/"):
            fragment = _graph_download_text(
                token,
                GRAPH_DRIVE_ID,
                item.get("id") or "",
                int(item.get("size") or 0),
            )

        if not fragment:
            fragment = (item.get("description") or "").strip()

        haystack = f"{name} {fragment}".lower()

        results.append(
            {
                "name": name,
                "url": item.get("webUrl") or "",
                "fragment": _fragment_around(fragment, tokens),
                "score": len([token_ for token_ in tokens if token_ in haystack]),
            }
        )

    results.sort(key=lambda item: item["score"], reverse=True)

    return results[:limit]


def search_documents(query: str, limit: int = 5) -> list:
    """Ищет документы по запросу. Возвращает список {name, url, fragment, score}."""
    normalized = (query or "").strip()

    if not normalized:
        return []

    if MODE == "off":
        raise OneDriveNotConfigured("Поиск по базе знаний отключён (ONEDRIVE_MODE=off).")

    if MODE == "mock":
        return _search_mock(normalized, limit)

    return _search_graph(normalized, limit)

