# Orto-N-L-M

> **AI-платформа для захвата экспертизы, управления корпоративными знаниями и обучения сотрудников.**

**Orto-N-L-M** превращает практический опыт сотрудников в структурированную базу знаний, инструкции, обучение и AI-помощь.

**Ортона-AI** — веб-интерфейс системы. **n8n** — оркестрация автоматизаций и AI-процессов. **PostgreSQL** — единое хранилище данных.

[![Live App](https://img.shields.io/badge/Live-Ortona--AI-0aa6a6?style=for-the-badge)](https://app.orto-n.ru)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![n8n](https://img.shields.io/badge/n8n-2.9.4-orange?style=flat-square&logo=n8n&logoColor=white)](https://n8n.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ed?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 🚀 Что это

В большинстве компаний знания о том, **как реально выполняется работа**, находятся в головах опытных сотрудников, переписках и разрозненных документах.

Orto-N-L-M строит из этого управляемую систему:

```text
Эксперт
   │
   ▼
AI-интервью
   │
   ▼
Process JSON
   │
   ├──────────────► Инструкция
   │
   ├──────────────► Обучение
   │
   ├──────────────► Тестирование
   │
   └──────────────► AI-помощник
                         │
                         ▼
                  Знания организации
```

Ключевая идея: **AI не является источником истины.** Он структурирует и использует знания, полученные от человека и сохранённые в канонической модели процесса.

---

## 🎯 Бизнес-задача

Система предназначена для компаний, где необходимо:

- быстро собирать экспертизу сильных сотрудников;
- превращать опыт в стандартизированные рабочие инструкции;
- ускорять адаптацию новых сотрудников;
- проверять фактическое знание рабочих процессов;
- снижать зависимость компании от отдельных носителей экспертизы;
- давать сотрудникам AI-доступ к внутренним знаниям.

По сути, Orto-N-L-M — это **цифровой слой между человеческой экспертизой и операционной работой компании**.

---

# 🧠 Архитектура

```text
                         ┌──────────────────────┐
                         │      ОРТОНА-AI       │
                         │     Web Interface    │
                         └──────────┬───────────┘
                                    │ HTTPS / API
                                    ▼
                         ┌──────────────────────┐
                         │   FastAPI Backend    │
                         │ Auth / RBAC / CRUD   │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
              PostgreSQL          n8n            OpenAI
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
                             Process JSON
                           Canonical Knowledge
```

### Принцип разделения ответственности

| Слой | Ответственность |
|---|---|
| **Ортона-AI** | пользовательский интерфейс |
| **FastAPI** | API, аутентификация, RBAC, CRUD |
| **n8n** | оркестрация workflow, AI-процессы, автоматизация |
| **PostgreSQL** | постоянное хранение данных |
| **Process JSON** | каноническая модель знаний |
| **OpenAI** | AI-интервью и интеллектуальная обработка |

Такое разделение позволяет развивать UI, backend и AI-автоматизацию независимо, не превращая n8n в единственное место хранения бизнес-данных.

---

# 👥 Три роли — один контур знаний

## 👨‍💼 Руководитель

Управляет рабочей структурой организации:

- должностями;
- инструкциями;
- процессами;
- содержимым базы знаний.

Для руководителя реализован отдельный интерфейс управления. Операции изменения защищены серверной проверкой роли.

## 🧑‍🔧 Специалист

Передаёт системе собственную практическую экспертизу через AI-интервью.

AI задаёт уточняющие вопросы, собирает детали процесса и формирует структурированный **Process JSON**.

## 🎓 Стажёр

Получает доступ к знаниям, необходимым для конкретной должности:

1. выбирает должность;
2. изучает инструкции;
3. проходит тестирование;
4. получает результат;
5. при необходимости повторяет тест.

---

# 🧩 Process JSON — сердце системы

**Process JSON является каноническим источником знаний.**

Производные сущности — инструкции, тесты и AI-ответы — должны строиться на его основе.

Пример модели:

```json
{
  "metadata": {
    "interviewee": "",
    "role": "",
    "position": "",
    "employee_position": "",
    "process": ""
  },
  "goal": "",
  "steps": [
    {
      "id": "step1",
      "title": "",
      "instruction": "",
      "expected_result": "",
      "attachments": [],
      "exceptions": [],
      "tips": [],
      "notes": ""
    }
  ]
}
```

Это важное архитектурное решение: **знания организации не зависят от конкретного интерфейса**.

---

# 🤖 AI Interview

Один из ключевых контуров системы — автоматизированное интервью специалиста.

AI не просто просит «описать работу». Интервью строится адаптивно: следующие вопросы зависят от уже полученной информации и направлены на выявление операционных деталей.

В результате система получает структурированную модель процесса, которую можно использовать дальше без повторного интервью.

```text
Ответ специалиста
       ↓
AI уточняет
       ↓
Следующий вопрос
       ↓
Нормализация
       ↓
Process JSON
       ↓
Сохранение
       ↓
Инструкция / обучение / тест
```

Поддерживается работа с текстовыми, голосовыми ответами и необходимыми визуальными материалами.

---

# 🔐 Backend и безопасность

Текущий проект уже содержит отдельный backend на **FastAPI**.

Реализованы:

- JWT-аутентификация;
- проверка пароля через bcrypt;
- серверная авторизация по ролям;
- защищённые API endpoints;
- CRUD для рабочих сущностей;
- CORS для веб-приложения;
- подключение к PostgreSQL;
- Docker-деплой backend.

### RBAC

Права определяются **на сервере**, а не только интерфейсом.

Например, наличие кнопки «Удалить» в UI не является механизмом безопасности: backend самостоятельно проверяет роль пользователя перед выполнением защищённой операции.

---

# 🗄️ Data model

Основные сущности PostgreSQL:

```text
users
  │
  ├── roles
  │
  ├── interview_sessions
  │
  └── manager_sessions

positions
  │
  └── processes
          │
          └── process_json

files
```

Процессы связаны с должностями, а `process_json` содержит структурированное описание рабочего процесса.

---

# 🖥️ Ортона-AI

Веб-интерфейс создан как самостоятельный продуктовый слой системы.

### Реализовано

- современный responsive UI;
- авторизация;
- ролевая навигация;
- кабинет руководителя;
- управление должностями;
- управление инструкциями;
- кабинет специалиста;
- AI-интервью;
- интерфейс стажёра;
- обучение по инструкциям;
- тестирование знаний;
- результаты тестирования;
- повторное прохождение теста;
- AI-раздел «Задать вопрос»;
- работа с вложениями;
- единая визуальная система интерфейса.

### Screenshots

#### Авторизация

![Ortona-AI — авторизация](docs/screenshots-web/login.png)

#### Руководитель

![Ortona-AI — руководитель](docs/screenshots-web/manager.png)

#### Специалист

![Ortona-AI — специалист](docs/screenshots-web/specialist.png)

#### Стажёр

![Ortona-AI — стажёр](docs/screenshots-web/trainee.png)

#### AI-помощник

![Ortona-AI — задать вопрос](docs/screenshots-web/question.png)

---

# 🛠️ Tech Stack

### Frontend

- React 19
- Vite
- JavaScript
- Lucide React
- CSS

### Backend

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL driver
- JWT
- bcrypt

### AI / Automation

- OpenAI API
- `gpt-4.1-mini`
- n8n **2.9.4 Self Hosted**

### Infrastructure

- Ubuntu Server 24.04 LTS
- Docker
- PostgreSQL 16
- Traefik

---

# 📁 Repository structure

```text
Orto-N-L-M/
│
├── backend/                # FastAPI backend
│   ├── main.py             # API
│   ├── auth.py             # JWT / RBAC
│   ├── database.py         # DB connection
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
│
├── frontend/
│   └── ortona-ai/          # React web application
│
├── sql/                    # database schema
├── docs/                   # project documentation / screenshots
├── prompts/                # AI prompts
├── data/                   # project data
│
├── PROJECT.md              # architectural contract
├── README.md
└── LICENSE
```

---

# 🔄 Current status

### Completed

- [x] core Orto-N-L-M architecture;
- [x] Process JSON model;
- [x] AI interview workflow;
- [x] process and instruction generation;
- [x] manager role;
- [x] specialist role;
- [x] trainee role;
- [x] learning and testing contour;
- [x] React web interface;
- [x] FastAPI backend;
- [x] JWT authentication;
- [x] server-side RBAC;
- [x] PostgreSQL integration;
- [x] frontend ↔ backend API;
- [x] backend Docker deployment;
- [x] web application deployment at `app.orto-n.ru`;
- [x] manager instruction creation through the web interface.

### In progress

- [ ] final integration of web application with the existing n8n automation layer;
- [ ] unified end-to-end execution of AI workflows from the web interface.

### Next

- [ ] RAG / vector search;
- [ ] expanded AI knowledge assistant;
- [ ] learning analytics;
- [ ] deeper automation of organisational processes.

---

# 🧠 Engineering decisions

### 1. Process JSON is the source of truth

The system separates canonical knowledge from presentation layers. UI, instructions, tests and AI responses should consume structured knowledge rather than inventing their own facts.

### 2. Deterministic routing over AI routing

Where a workflow decision can be represented as a deterministic rule, the system prefers explicit routing over asking an LLM to decide what should happen next.

### 3. Backend owns permissions

Authorization is enforced server-side. Frontend visibility is a UX concern, not a security boundary.

### 4. n8n is an orchestrator

n8n is used for automation and AI workflow execution. Persistent business data belongs in PostgreSQL and API access is handled by the backend.

### 5. Web is the product interface

Telegram was used during the earlier validation stage. The current product direction is the Ortona-AI web application.

---

# 👨‍💻 About the project

Orto-N-L-M is a practical AI engineering project focused on combining:

- AI agents;
- workflow automation;
- backend development;
- role-based access control;
- PostgreSQL data modelling;
- React interfaces;
- Docker infrastructure;
- corporate knowledge management.

The goal is not to demonstrate a single AI prompt or a collection of disconnected automations.

**The goal is to build a complete AI product — from expert knowledge capture to a working employee experience.**

---

# 🌐 Live

**Ortona-AI:** https://app.orto-n.ru

**GitHub:** https://github.com/AlekseyHorjakov/Orto-N-L-M

---

# 🔒 Security

This repository is public. Secrets and credentials are intentionally excluded from version control.

Never commit:

- API keys;
- passwords;
- JWT secrets;
- Telegram bot tokens;
- private credentials;
- production `.env` files.

See `.gitignore` for the current exclusions.

---

# 📄 License

MIT — see [LICENSE](LICENSE).
