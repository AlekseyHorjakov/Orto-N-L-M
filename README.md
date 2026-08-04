# Orto-N-L-M

> AI-платформа автоматического извлечения, структурирования и управления знаниями сотрудников компании.

---

# О проекте

Orto-N-L-M — универсальная AI-система, предназначенная для автоматического извлечения знаний сотрудников компании.

Во время интервью система собирает знания эксперта и преобразует их в единый структурированный формат.

На основе полученных данных автоматически формируются:

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

```
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
- Сначала MVP, затем развитие функциональности.
- Документация является частью архитектуры проекта.

---

# Текущее состояние проекта

## Реализовано

- Общая архитектура проекта
- Process JSON v1.0
- Unified Message
- PostgreSQL Schema
- Interview Agent Prompt
- Telegram Input Gateway
- Message Type Router
- Normalize Text

## В разработке

- Intent Classifier
- Intent Router
- Interview Workflow
- PostgreSQL Integration

## Планируется

- Генерация инструкций
- Генерация тестов
- Генерация учебных курсов
- Корпоративная база знаний
- AI Assistant

---

# Архитектура обработки сообщений

Каждое входящее сообщение проходит одинаковый путь обработки.

```
Transport

↓

Input Gateway

↓

Message Type Router

↓

Normalize Text

↓

Intent Classifier

↓

Intent Router

↓

Business Workflow
```

Каждый Workflow отвечает только за одну бизнес-задачу.

---

# Структура проекта

```
data/
prompts/
sql/
workflows/

.env.example
PROJECT.md
README.md
```

---

# Документация

| Документ | Назначение |
|----------|------------|
| PROJECT.md | Общее описание проекта |
| prompts/interview_agent.md | Системный промпт Interview Agent |
| sql/schema.sql | Структура базы данных PostgreSQL |

---

# Используемый стек

- Ubuntu Server 24.04 LTS
- Docker 29.6.1
- Docker Compose 2.39.x
- PostgreSQL 17.6
- pgvector 0.8.2
- n8n 2.29.10 (Self Hosted)
- Python 3.14
- OpenAI API

---

# Статус проекта

🚧 Проект находится в стадии активной разработки.

На текущий момент сформирована архитектура и базовая инфраструктура системы.

Следующий этап — реализация бизнес-логики Interview Workflow.

---

# Roadmap

- [x] Архитектура проекта
- [x] Process JSON
- [x] Unified Message
- [x] PostgreSQL Schema
- [x] Interview Agent Prompt
- [x] Telegram MVP
- [ ] Intent Classifier
- [ ] Intent Router
- [ ] Interview Workflow
- [ ] PostgreSQL Integration
- [ ] Knowledge Generator
- [ ] Test Generator
- [ ] Course Generator
- [ ] AI Assistant

---

# Лицензия

MIT