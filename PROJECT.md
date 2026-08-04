---

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
      "instruction": [
        ""
      ],
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
Ссылки на связанные материалы (изображения, PDF, DOCX, видео и т.д.).

#### step.exceptions
Нестандартные ситуации и порядок действий.

#### step.tips
Полезные рекомендации.

#### step.notes
Дополнительные замечания.

---

# Database Schema v1.0

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
Хранение процессов и их JSON.

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
- type
- storage_path
- original_name
- mime_type

## Транспорт

Первой реализацией клиента является Telegram.

Telegram используется только как демонстрационный транспорт.

Вся бизнес-логика должна работать исключительно через Input Gateway.

Замена Telegram на Web, Desktop или другой интерфейс не должна требовать изменения внутренней логики системы.

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