# Контракт Masterboard ↔ lorebridge, версия 1

Решения: E1 — привязка сервисов, E2 — lorebook и lovegame сразу, E3 — архив в lorebook, E4 — systemsetup только на чтение.

## Транспорт и вход

- Masterboard вызывает lorebridge **только со своего Worker** через service binding `LOREBRIDGE` (оба Worker на одном аккаунте Cloudflare; прямые вызовы `*.workers.dev` между ними дают 1042).
- Заголовки каждого запроса:
  - `X-Masterboard-Secret` — общий секрет (`wrangler secret put MASTERBOARD_BRIDGE_SECRET` в обоих Worker). Без совпадения — `401`.
  - `X-Masterboard-User` — почта мастера, уже проверенная Masterboard через Cloudflare Access.
- lorebridge сопоставляет почту с аккаунтами Lorebook и LoveGame тем же способом, что `people.ts`, и **сам проверяет права** в каждом обработчике (как для Firebase-токенов). Нет аккаунта — `403 {error, side, kind:'denied'}`.
- Ошибки — обычный формат моста `{error, side?, kind?, status?}`.
- Все маршруты под префиксом `/mb/`. В `/manifest` добавляется возможность `masterboard` и DTO `masterboard: 1`; фикстуры — в `fixtures/masterboard.*.json`.

## Маршруты

### `GET /mb/connections`
Что доступно этому мастеру.
```json
{ "connections": [
  { "system": "lorebook", "scope": "world", "externalId": "<worldId>", "label": "<имя мира>", "url": "https://lorebook…/w/<worldId>" },
  { "system": "lovegame", "scope": "campaign", "externalId": "<campaignId>", "label": "<имя кампании>", "url": "…" },
  { "system": "systemsetup", "scope": "system", "externalId": "packs", "label": "Игровые системы" }
] }
```
lorebook — миры, где мастер автор; lovegame — кампании, где он мастер (`masterId` или `shared`); systemsetup — одна запись, если есть ключ `SYSTEMSETUP_KEY`.

### `GET /mb/passport?system=&externalId=`
Паспорт возможностей в формате Masterboard `CapabilityPassport` (без `connectionId` — его ставит Masterboard):
```json
{ "fetchedAt": "ISO", "entities": [
  { "entityType": "character", "label": "Персонаж", "enabled": true,
    "operations": ["read","create","update","archive","change-visibility","change-status"],
    "statuses": ["draft","review","approved","canon","nonCanon","archived"], "shortFields": ["Роль","Чего хочет"] }
] }
```
- lorebook: включённые типы мира (`worldTypes()`), кроме `template`; операции `read, create, update, change-visibility, change-status, archive`. Для не-автора мира — только `read`.
- lovegame: `npc`, `handout`, `codex` с учётом модулей кампании; операции `read, create, update, change-visibility`. Архива нет (`unavailableReason`).
- systemsetup: `system` — только `read`.

### `GET /mb/entities?system=&externalId=[&since=<ms>][&type=]`
Проекции для чтения, отсортированы по `updatedAt`.
```json
{ "items": [
  { "id": "<externalEntityId>", "type": "character", "name": "…", "summary": "…", "tags": ["…"],
    "fields": { "Роль": "…" }, "visibility": "public|master", "status": "canon", "archived": false,
    "updatedAt": 1790000000000, "url": "https://…" }
], "ids": ["<все живые id — чтобы увидеть жёсткие удаления>"] }
```
- lorebook: `visibility` = `master`, если `access === 'hidden'`; текст (markdown) в список не входит.
- lovegame: `visibility` из `visibleToPlayer`; `summary` — публичная часть (`publicBody`/`body`/`shortDesc`); мастерские поля (`gmBody`) не отдаются.
- systemsetup: опубликованные системы `{id: key, type:'system', name, summary, updatedAt}`.

### `POST /mb/publish`
```json
{ "system": "lorebook", "externalId": "<worldId>", "operation": "create|update|archive|change-visibility|change-status",
  "entityType": "character", "entityId": "<externalEntityId для не-create>", "expectedUpdatedAt": 1790000000000,
  "idempotencyKey": "<id операции Masterboard>", "patch": { "name": "…", "summary": "…", "tags": [], "fields": {}, "visibility": "public|master", "status": "…" } }
```
- Ответ: `{ "id": "<externalEntityId>", "updatedAt": <ms>, "url": "…" }`.
- `expectedUpdatedAt` не совпал — `409 { error, current: <item как в /mb/entities> }` (Masterboard показывает пополевой конфликт, решение I4).
- Повтор с тем же `idempotencyKey` в течение суток возвращает первый результат (KV).
- lorebook: `create` пишет как `/entity` (без привязки к кампании), `update` — через общий путь редактирования с историей, `archive` — статус `archived` (E3), `change-visibility` — `access` hidden/read.
- lovegame: `npc` → `npcs`, `handout` → `handouts`, `codex` → `codex`; `visibility` → `visibleToPlayer`.
- systemsetup: только чтение — `405`.
