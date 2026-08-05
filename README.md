# Orto-N-L-M

> AI-платформа автоматического извлечения, структурирования и управления знаниями сотрудников компании.

---

# О проекте

Orto-N-L-M — универсальная AI-система, предназначенная для автоматического извлечения знаний сотрудников компании.

Во время интервью система собирает знания эксперта и преобразует их в единый структурированный формат.

На основе полученного **Process JSON** автоматически формируются:

- инструкции;
- тесты;
- учебные курсы;
- статьи базы знаний;
- AI-помощник.

Проект не привязан к конкретной компании и может использоваться в любой организации.

---

# Главная идея

В системе существует только один источник истины — **Process JSON**.

Все остальные материалы автоматически генерируются на его основе.

```text
Эксперт
    ↓
Interview Agent
    ↓
Process JSON
    ├── Инструкции
    ├── Тесты
    ├── Курсы
    ├── База знаний
    └── AI Assistant
```

---

# Архитектурные принципы

- Один компонент — одна ответственность.
- Один агент — одна задача.
- Process JSON — единственный источник истины.
- Бизнес-логика полностью отделена от транспорта.
- Telegram используется только как демонстрационный транспорт.
- Agent не взаимодействует напрямую с инфраструктурой.
- Workflow отвечает только за маршрутизацию и интеграцию компонентов.
- Сначала MVP, затем развитие функциональности.
- Документация является частью архитектуры проекта.

---

# Текущее состояние проекта

## Реализовано

- Общая архитектура проекта
- Process JSON v1.0
- Unified Message v1.0
- Unified Agent Response v1.0
- PostgreSQL Schema v1.1
- Interview Agent Prompt
- Telegram Input Gateway
- Message Type Router
- Normalize Text
- Navigation Router
- Interview Session Router
- Parse Agent Response
- Первый рабочий запуск Interview Agent
- Отдельная база данных `orto_n`
- Таблица `interview_sessions`

## В разработке

- Завершение Interview Workflow
- PostgreSQL Save Process
- Interview Session Router (работа через PostgreSQL)
- Завершение полного цикла интервью

## Планируется

- Генерация инструкций
- Генерация тестов
- Генерация учебных курсов
- Корпоративная база знаний
- AI Assistant

---

# Архитектура обработки сообщений

Каждое входящее сообщение проходит одинаковый путь обработки.

```text
Transport
    ↓
Input Gateway
    ↓
Interview Session Router
    ↓
IF (есть активное интервью?)
    ├── YES → Interview Agent
    │
    └── NO
            ↓
     Message Type Router
            ↓
     Navigation Router
            ↓
     Business Workflow
```

Каждый Workflow отвечает только за одну бизнес-задачу.

---

# Interview Workflow

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

Ответ Interview Agent проходит через **Parse Agent Response**.

Workflow принимает решение:

- продолжить интервью;
- завершить интервью;
- сохранить Process JSON после завершения интервью.

---

# Структура проекта

```text
data/
prompts/
sql/
workflows/

.env.example
AI_CONTEXT.md
PROJECT.md
README.md
```

---

# Документация

| Документ                   | Назначение                              |
| -------------------------- | --------------------------------------- |
| AI_CONTEXT.md              | Полное восстановление контекста проекта |
| PROJECT.md                 | Архитектура проекта                     |
| prompts/interview_agent.md | Системный Prompt Interview Agent        |
| sql/schema.sql             | Структура базы данных PostgreSQL        |

---

# Используемый стек

- Ubuntu Server 24.04 LTS
- Docker 29.6.1
- Docker Compose 2.39.x
- PostgreSQL 17.6
- pgvector 0.8.2
- n8n 2.29.10 (Self Hosted)
- Python 3.14.5
- OpenAI API

---

# Статус проекта

🚧 Проект находится в активной разработке.

### Уже реализовано

- архитектура проекта;
- инфраструктура Telegram;
- Interview Agent;
- первый рабочий запуск интервью;
- отдельная база данных `orto_n`;
- базовая схема PostgreSQL;
- хранение состояния интервью.

### Следующая цель

Завершить полный цикл интервью и автоматически сохранять Process JSON в PostgreSQL.

---

# Roadmap

- [x] Архитектура проекта
- [x] Process JSON
- [x] Unified Message
- [x] Unified Agent Response
- [x] PostgreSQL Schema
- [x] Interview Agent Prompt
- [x] Telegram MVP
- [x] Navigation Router
- [x] Interview Session Router
- [x] Parse Agent Response
- [x] Первый запуск Interview Agent
- [ ] Завершение Interview Workflow
- [ ] PostgreSQL Save Process
- [ ] Knowledge Generator
- [ ] Test Generator
- [ ] Course Generator
- [ ] AI Assistant

---

# Лицензия

MIT
