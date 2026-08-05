# Process JSON v1.0

```json
{
  "metadata": {
    "process_name": "",
    "position": ""
  },
  "goal": "",
  "steps": [
    {
      "id": "step_001",
      "title": "",
      "instruction": [""],
      "expected_result": "",
      "attachments": [],
      "exceptions": [],
      "tips": [],
      "notes": ""
    }
  ]
}
```

## Описание

### metadata

- process_name — название процесса.
- position — должность сотрудника.

### goal

Цель процесса.

### steps

Массив шагов процесса.

#### step.id

Уникальный идентификатор шага.

#### step.title

Название шага.

#### step.instruction

Последовательность действий для выполнения шага.

#### step.expected_result

Ожидаемый результат выполнения шага.

#### step.attachments

Ссылки на связанные материалы (изображения, PDF, DOCX, XLSX, видео и т.д.).

#### step.exceptions

Нестандартные ситуации и порядок действий.

#### step.tips

Полезные рекомендации.

#### step.notes

Дополнительные замечания.

---

# Database Schema v1.1

## Таблицы

### positions

Назначение:

Хранение списка должностей.

Поля:

- id
- name

---

### processes

Назначение:

Хранение процессов и их Process JSON.

Поля:

- id
- position_id
- name
- goal
- process_json

---

### files

Назначение:

Хранение информации о прикрепленных файлах.

Поля:

- id
- original_name
- storage_path
- mime_type
- file_type

---

### interview_sessions

Назначение:

Хранение состояния интервью пользователя.

Используется для определения наличия активной сессии интервью.

Поля:

- id
- user_id
- status
- created_at
- updated_at

Таблица не хранит:

- Process JSON;
- историю сообщений;
- знания процесса.

Допускается только одно активное интервью на пользователя.

История завершенных интервью поддерживается отдельно.

---

# Транспорт

Первой реализацией клиента является Telegram.

Telegram используется только как демонстрационный транспорт.

Вся бизнес-логика работает исключительно через Input Gateway.

Замена Telegram на Web, Desktop или другой интерфейс не должна требовать изменения бизнес-логики системы.

---

# Unified Message v1.0

```json
{
  "source": "",
  "user": {
    "id": "",
    "first_name": ""
  },
  "chat": {
    "id": "",
    "type": ""
  },
  "message": {
    "id": "",
    "type": "",
    "text": "",
    "timestamp": 0
  }
}
```

---

# Unified Agent Response v1.0

Interview Agent всегда возвращает ответ в едином формате.

```json
{
  "status": "continue | completed",
  "message": "",
  "process_json": null
}
```

Данный контракт используется между Interview Agent и Workflow.

Workflow принимает решения только на основании полей Unified Agent Response и не анализирует свободный текст LLM.

---

# Interview Workflow

Interview Workflow состоит из двух частей.

## Инфраструктура

- Telegram Trigger
- Input Gateway
- Interview Session Router
- Message Type Router
- Navigation Router
- Parse Agent Response
- PostgreSQL

## Бизнес-логика

Interview Agent отвечает исключительно за проведение интервью.

Workflow отвечает только за:

- маршрутизацию сообщений;
- управление состоянием интервью;
- взаимодействие с PostgreSQL;
- передачу данных между компонентами.

Interview Agent не взаимодействует напрямую с PostgreSQL и не знает об инфраструктуре n8n.

---

## Последовательность работы

```text
Telegram Trigger
        ↓
Input Gateway
        ↓
Interview Session Router
        ↓
IF (есть активное интервью?)
        ├── YES → Interview Agent
        │
        └── NO → Message Type Router
                    ↓
             Navigation Router
                    ↓
          IF (route == interview)
                ├── YES
                │      ├── Create Interview Session (PostgreSQL)
                │      └── Interview Agent
                │
                └── NO → Navigation
```

После выполнения Interview Agent ответ передается в Parse Agent Response.

Workflow принимает решение:

- продолжить интервью;
- завершить интервью;
- сохранить Process JSON после завершения интервью.
