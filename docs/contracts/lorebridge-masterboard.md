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
- lorebook: включённые типы мира (`worldTypes()`), кроме `template`; операции `read, create, update, change-visibility, change-status, archive`. Для не-хозяина мира — всё, кроме `change-visibility` (в Лорбуке правит всякий автор; скрывать запись от игроков вправе только хозяин мира), и `unavailableReason` объясняет это.
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

### `GET /mb/schema?system=&externalId=` — необязательно (ТЗ-2, R2, 27.09.2026)
Поля карточек по типам записей — чтобы Мастерборд показывал в карточке поля мира, стола и системы («Из основы»).
```json
{ "types": [ { "type": "npc-light", "fields": [ { "label": "Ранг" }, { "label": "Биография", "long": true } ] } ] }
```
- Пока в мосту маршрута нет, он отвечает `404` — Мастерборд считает, что схемы нет, и берёт поля из уже импортированных записей.
- systemsetup: `externalId` — `packs`; поля — из схемы опубликованной системы.

### `POST /mb/publish`
```json
{ "system": "lorebook", "externalId": "<worldId>", "operation": "create|update|archive|change-visibility|change-status",
  "entityType": "character", "entityId": "<externalEntityId для не-create>", "expectedUpdatedAt": 1790000000000,
  "idempotencyKey": "<id операции Masterboard>", "patch": { "name": "…", "summary": "…", "tags": [], "fields": {}, "visibility": "public|master", "status": "…" } }
```
- Ответ: `{ "id": "<externalEntityId>", "updatedAt": <ms>, "url": "…" }`.
- `expectedUpdatedAt` не совпал — `409 { error, current: <item как в /mb/entities> }` (Masterboard показывает пополевой конфликт, решение I4).
- Повтор с тем же `idempotencyKey` в течение суток возвращает первый результат (KV).
- lorebook: `create` пишет как `/entity` (без привязки к кампании), `update` — через общий путь редактирования, **без снимка в историю** (история правок — у самого Лорбука), `archive` — статус `archived` (E3), `change-visibility` — `access` hidden/read.
- lovegame: `npc` → `npcs`, `handout` → `handouts`, `codex` → `codex`; `visibility` → `visibleToPlayer`.
- systemsetup: только чтение — `405`.

## КК9 (`system: 'kk9'`) — добавлено 27 сентября 2026

Четвёртый берег, необязательный, как Систем Сетап: без секрета `KK9_KEY` в мосту
строки `kk9` в `/mb/connections` нет, ручки отвечают 501. Аудит и решения —
`systemsetup/docs/tz/m0-kk9-masterboard-audit-2026-09-27.md`; код моста —
`lorebridge/src/kk9.ts`.

- **Кто мастер.** Роль считается как в `kk9app/src/lib/roles.js`: глобальный
  игрок — игрок везде. Глобальный `gm` — мастер там, где не записан игроком или
  demo; `admin` — мастер, только если в кампании не записан другой мастер
  (`members[x] === 'gm'`). Почта ищется в `users/{uid}.email` КК9. Учётки в
  Лорбуке и ЛавГеймс для входа не нужны.
- **`connections`**: `scope: 'campaign'`, `externalId` — id кампании КК9;
  архивные кампании не называются.
- **`passport`**: `character`, `npc-board`, `place` — только `read`; шесть
  видов библиотеки — `npc-light`, `npc-hard`, `npc-boss`, `curator`,
  `companion`, `daemon` — `read, create, update, change-visibility`, каждый
  своим назначением; `item` — `create, update`. Факультеты не едут.
- **`entities`**:
  - `character` — публичная часть листа: имя, биография (текстом), поля
    «Игрок», «Факультет», «Курс», «Пол», «Возраст», «Место рождения»,
    «Общежитие», «Рост», «Телосложение». Числа листа, деньги, опыт,
    `private/gm` и `log` не читаются;
  - виды библиотеки — каждый своим типом (`npc-light` … `daemon`),
    видимость — `visibleToPlayers`; `npc-board` — НПС доски со своим
    статблоком (id с приставкой `board:`, видимость `public`); связанный с
    библиотекой второй строкой не едет. `type=npc` отдаёт все виды разом.
    Поле «Статблок» — одной строкой;
  - `place` — сцены: название, текст, «Фон», «Сейчас: Активная сцена».
  - `updatedAt` — время правки, а пока КК9 его не пишет — время создания.
- **`publish`** (этап М3):
  - виды библиотеки → библиотека КК9 тем видом, что назван назначением
    (новая запись скрыта от игроков, поля — как `libraryDefaultsFor` КК9);
    `update`, `change-visibility` (`visibleToPlayers`). Вид правкой не
    меняется. Свои поля вида — на места (люди: «Роль», «Раса», «Пол»,
    «Возраст», «Заметки»; спутник: «Вид существа», «Возраст», «Связь»;
    даймон: «Настоящее имя», «Внешность», «Мечта», «Страх», «Желание»);
    остальные — абзацем «— Из Masterboard —» (у людей в заметки, у спутника
    и даймона в описание), при чтении он разбирается обратно, при записи
    заменяется. «Статблок» и словарные поля даймона не пишутся. Прежнее
    общее имя `npc` принимается: новое — лёгкий НПС, правка — вид записи.
    НПС доски (`board:`) не правится;
  - `item` → каталог (`ownerCharacterId: null`): вид из поля «Вид» (оружие,
    снаряжение, артефакт, заклинание, устройство, транспорт; по умолчанию
    снаряжение), поля вида — как `defaultsFor` КК9; незнакомые поля — абзацем
    в описание. Выданный персонажу предмет не правится (403). Читается только
    по `type=item` — для «Обновить из источника»;
  - персонаж и место не пишутся (400), архива и статусов нет (400);
  - id созданного — от ключа повтора: повтор обновляет ту же запись;
  - свежесть: `updatedAt` (его ставит мост и, после `kk9app#121`, сам КК9), а
    без него — отпечаток содержимого.
- Masterboard кладёт `place` в тип `location`.

### КК9 на планировании сессий (этап М4) — добавлено 27 сентября 2026

Аудит и решения — `systemsetup/docs/tz/m4-kk9-session-planning-2026-09-27.md`.

- **Места → сцены КК9.** Тип `place` пишется (`create`, `update`): название,
  описание → текст, «Фон» → фон, незнакомые поля — абзацем в текст; сцена
  заводится неактивной. Обратно приходит тем же местом. Сцена плана Masterboard
  — запись для мастера и в КК9 не едет (Р-3).
- **`GET /mb/state?system=kk9&externalId=`** — живое состояние стола:
  `campaign {name, gameDate, weather, worldNote, nextSession}`,
  `party[] {id, name, physical, mental, energy, tension {current, max, overcap, zone}, stunned, statuses[] {name, term}}`,
  `journal[] {id, stream, title, body, at}` (последние десять каждого потока,
  без архива), `requests[] {id, kind, character, name, description, at}`
  (только открытые). Только мастеру; Masterboard его не сохраняет.
- **`POST /mb/session`** `{system: 'kk9', externalId, idempotencyKey, journal?, nextSession?}`:
  `journal {stream, title, body, expectedFingerprint?, force?}` — страница под
  id от ключа повтора (id сессии Masterboard), повтор её переписывает; правка в
  КК9 после прошлой отправки → в ответе `journal: {ok: false, status: 409,
  current}`, `force` переписывает (Р-4). `nextSession` — строка, как её пишет
  КК9. Ответ — частичный результат по каждой части.
- Worker пропускает `state` (GET) и `session` (POST).

### Резервная копия (этап М5) — добавлено 27 сентября 2026

Копию делает мост: ночью, после укладки индекса (00:40 по Москве), своим
пробуждением. Кампании кладутся в приватный репозиторий бэкапа, папкой
`мастерборд/`: по файлу на кампанию в формате «Экспорта»
(`masterboard-local-campaign/v1`), так что вернуть кампанию можно кнопкой
«Импорт». Рядом лежит `README.md` с описью. Если копия не прошла, мост пишет в те же телеграм-чаты, что
при бэкапе Лорбука и ЛавГеймс, и кладёт итог в своё хранилище. Бэкапы мира и
кампаний ЛавГеймс от этого не зависят.

| Направление | Маршрут | Что |
|---|---|---|
| мост → Masterboard | `POST /api/internal/backup` | Привязкой сервиса `MASTERBOARD_SITE`, заголовок `x-masterboard-secret`. Проверка Access не идёт (привязка её обходит), поэтому пускает только общий секрет. Ответ: `{documents: [{path, data, revision, updatedAt, updatedBy}]}` — все общие кампании, без проверки членства. Без секрета у воркера — 501, чужой секрет — 401, не POST — 405 |
| Masterboard → мост | `GET /mb/backup` | Итог последней копии: `{configured, folder, schedule, last: {at, state: 'записано' \| 'без изменений' \| 'ошибка', campaigns, files, error?, повод} \| null}` |
| Masterboard → мост | `POST /mb/backup` | Копия сейчас; отвечает тем же итогом. Жмёт любой вошедший мастер (страница «Резервные копии» рядом со списком кампаний) |

Порядок выката: сперва Masterboard (маршрут), потом мост (привязка к воркеру,
которого нет, роняет `deploy`).
