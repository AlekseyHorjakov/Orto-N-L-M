# Current Workflow Snapshot

**Workflow:** Orto-N Learning Manager  
**Export:** `Orto-N Learning Manager (33).json`  
**Дата экспорта:** 4 сентября 2026  
**Статус:** active  
**Количество узлов:** 75  
**n8n:** 2.9.4 Self Hosted  
**Model:** gpt-4.1-mini

## Контуры

### Telegram

`Telegram Trigger → Input Gateway → Session Router → Message Type Router → Navigation / media branches`

### Интервью

`Create Interview Session → Interview Agent → Parse Agent Response → Normalize Interview → Save Interview → Get Saved Process → Instruction Generator → HTML → Telegram`

### Вложения

Скриншоты/фото привязываются к конкретным шагам Process JSON. `Prepare HTML Attachments` использует сохранённые пути и метаданные файлов.

### Руководитель

`Должности` и `Инструкции`.

Для должностей реализованы добавление, редактирование и удаление с подтверждением. При удалении должности сначала удаляются связанные процессы.

### Стажёр

`Обучение → инструкция → Тестирование → проверка → HTML-результат`.

Тест генерируется только по Process JSON, варианты перемешиваются с сохранением правильного ответа, состояние сохраняется в PostgreSQL.

## Важная деталь экспорта

В workflow есть три HTTP Request узла, которые обращаются к Telegram Bot API и содержат токен непосредственно в URL. Это часть текущего рабочего экспорта.

Поскольку репозиторий публичный, живой токен намеренно не помещается в GitHub. Необходимо хранить его только в рабочем окружении n8n и не копировать в публичные файлы.

## Источник истины

Для точного восстановления workflow используется исходный экспорт n8n, загруженный в проект. Документация GitHub фиксирует архитектуру и состояние, но не подменяет рабочий секретный экспорт.
