# My Calendar — дизайн

Личный календарь-планировщик. SPA на Vite + React + TypeScript, деплой на Vercel.

## Хранение и доступ
- Все данные — один JSON `calendar.json` в приватном Vercel Blob.
- `POST /api/login` — сверяет пароль с `APP_PASSWORD`, выдаёт HMAC-токен на 30 дней.
- `GET/PUT /api/data` — чтение/запись JSON, требует `Authorization: Bearer <token>`.
- Секрет подписи — `AUTH_SECRET`, если не задан — `APP_PASSWORD` (смена пароля разлогинивает).
- Локально (`npm run dev`) API обслуживает middleware Vite, данные в `.local-data/calendar.json`.
- Клиент: кэш в localStorage (мгновенный старт, флаг dirty), сохранение с debounce, last-write-wins.

## Модель
```ts
Task { id, title, date, start?, end?, color, note?, repeat, exceptions? }
Repeat { type: 'none'|'weekdays'|'days'|'weeks'|'monthly', days?, interval?, until? }
CalendarData { tasks: Task[], done: Record<taskId, isoDate[]>, updatedAt }
```
Повторы не размножаются: `occursOn(task, date)` — чистая функция, покрыта тестами.
Ежемесячно: число из даты начала, в коротких месяцах — последний день.

## UI
- Логин → неделя (7 колонок, шкала времени, строка «весь день», линия «сейчас») / день (по умолчанию на телефоне).
- Клик по слоту — создание, клик по задаче — редактирование, чекбокс на блоке — отметка на конкретную дату.
- Для серии в модалке переключатель «Этот день / Вся серия» (правка и удаление).
- Счётчик выполнено/всего в шапке дня, индикатор сохранения, экспорт/импорт JSON, выход.

## Вне рамок
Drag-and-drop, уведомления, вид месяца, несколько пользователей.
