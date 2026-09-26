# Запуск Мастерборда на Cloudflare

Однократная настройка. Всё делается в панели Cloudflare или с вашего компьютера; секреты в репозиторий не попадают.

**Уже сделано:** база D1 `masterboard` создана (`database_id` `1510a7e6-b2f9-4eeb-b2ef-5ad23b6f67c9` записан в `wrangler.jsonc`). Worker'ы `masterboard` и `lorebridge` живут в одном аккаунте — это нужно для привязки сервисов.

**Что понадобится:** доступ к панели Cloudflare этого аккаунта; для шагов в терминале — Node.js 20+, клоны `masterboard` и `lorebridge` с актуальным `main` и выполненный один раз `npx wrangler login`.

---

## Шаг 1. Таблицы в базе

В базе пока нет таблиц. Создайте их одним из способов.

**Терминал** (в папке `masterboard`):

```bash
npm ci
npm run worker:migrate      # = wrangler d1 migrations apply masterboard --remote
```

Wrangler покажет миграцию `0001_documents.sql` и спросит подтверждение — ответьте `y`.

**Или панель:** Storage & Databases → D1 → `masterboard` → вкладка **Console**. Консоль не принимает комментарии и пустые запросы («Requests without any query are not supported»), поэтому вставляйте команды **по одной**, без строк `--` и без `;` в конце:

```sql
CREATE TABLE IF NOT EXISTS documents (path TEXT PRIMARY KEY, collection TEXT NOT NULL, data TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)
```
```sql
CREATE INDEX IF NOT EXISTS documents_collection ON documents (collection)
```
```sql
CREATE TABLE IF NOT EXISTS campaign_members (campaign_path TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY (campaign_path, email))
```
```sql
CREATE INDEX IF NOT EXISTS campaign_members_email ON campaign_members (email)
```

(Wrangler при этом не узнает, что миграция применена; если позже запустить `worker:migrate`, он применит её ещё раз — это безопасно, там `IF NOT EXISTS`.)

> **26.09.2026:** для базы `masterboard` шаг 1 уже выполнен — таблицы созданы, миграция `0001_documents.sql` отмечена в `d1_migrations`.

**Проверка:** в D1 → `masterboard` → **Tables** видны `documents` и `campaign_members`.

---

## Шаг 2. Вход по почте (Cloudflare Access)

1. Панель → **Workers & Pages** → `masterboard` → **Settings** → **Domains & Routes** (или вкладка **Domains**).
2. У строки `workers.dev` нажмите **Enable Cloudflare Access**.
3. Нажмите **Manage Cloudflare Access** — откроется приложение Access. В политике (`masterboard - Production`) оставьте действие **Allow** и в **Include** выберите **Emails** — перечислите почты всех мастеров. (Можно **Emails ending in** — для целого домена.)
4. Способ входа по умолчанию — **One-time PIN**: Cloudflare присылает код на почту. Больше ничего настраивать не нужно.
5. Узнайте два значения:
   - **AUD** — Zero Trust → Access controls → Applications → приложение `masterboard` → **Overview** (или **Basic information**) → **Application Audience (AUD) Tag**, длинная строка.
   - **Team domain** — Zero Trust → **Settings** → **Team name and domain**, вида `имя-команды.cloudflareaccess.com`.
6. Впишите их в `wrangler.jsonc` в раздел `vars`:

   ```jsonc
   "vars": {
     "ACCESS_TEAM_DOMAIN": "имя-команды.cloudflareaccess.com",
     "ACCESS_AUD": "длинная-строка-AUD"
   }
   ```

   Это не секреты (их видно любому, кто смотрит заголовки), их можно коммитить. Можно просто прислать их мне — я впишу и смержу.

> Пока `ACCESS_TEAM_DOMAIN` и `ACCESS_AUD` пустые, сервер отвечает «Вход не настроен», и Мастерборд показывает только экран входа.

**Добавить мастера позже:** допишите его почту в политику Access (шаг 2.3), а в кампании владелец добавит его в разделе «Команда» с той же почтой.

---

## Шаг 3. Общий секрет для моста

Мастерборд ходит в lorebridge по привязке сервисов и подтверждает себя общим секретом. Значение должно быть **одинаковым** в обоих Worker'ах.

1. Придумайте длинную случайную строку, например:

   ```bash
   openssl rand -base64 32
   ```

2. Положите её в оба Worker'а.

   **Терминал:**

   ```bash
   cd masterboard  && npx wrangler secret put MASTERBOARD_BRIDGE_SECRET   # вставить строку, Enter
   cd ../lorebridge && npx wrangler secret put MASTERBOARD_BRIDGE_SECRET  # ту же строку
   ```

   **Или панель:** Workers & Pages → Worker → **Settings** → **Variables and Secrets** → **Add** → тип **Secret**, имя `MASTERBOARD_BRIDGE_SECRET`, значение → **Deploy**. Сделайте это для `masterboard` и для `lorebridge`.

Секрет нигде не записывайте в репозиторий и не присылайте в чат.

---

## Шаг 4. Выкатить lorebridge

В `main` lorebridge уже есть маршруты `/mb/*` (PR #76). Выкатите его **раньше** Мастерборда.

```bash
cd lorebridge
git checkout main && git pull
npm ci
npx wrangler deploy
```

**Проверка:** откройте `https://lorebridge.<ваш-поддомен>.workers.dev/manifest` — в ответе должна быть возможность `masterboard` (она включается, только когда задан секрет из шага 3).

---

## Шаг 5. Выкатить Мастерборд

```bash
cd masterboard
git checkout main && git pull     # в main уже есть database_id и (после шага 2) vars Access
npm ci
npm run deploy                    # = npm run build && wrangler deploy
```

> **Если у Worker'а включена сборка из Git** (Workers & Pages → Worker → **Settings** → **Build**, подключён репозиторий), Cloudflare сам выкатывает `main` после каждого мерджа — тогда шаги 4–5 сводятся к проверке, что последняя сборка прошла успешно (вкладка **Deployments**).

---

## Шаг 6. Проверка целиком

1. Откройте `https://masterboard.<ваш-поддомен>.workers.dev` → страница Cloudflare Access → введите почту → код из письма.
2. Откроется список кампаний с вашей почтой в шапке. Если в этом браузере были кампании до входа — появится плашка «Перенести все».
3. Создайте кампанию → **Публикация** → блок **Связи кампании** покажет ваши миры Лорбука и кампании ЛавГеймс. Выберите нужные.
4. **Библиотека → Из источника** — должны появиться записи связанного мира.

### Если что-то не так

| Что видно | Причина | Что сделать |
|---|---|---|
| Только экран «Вход» после ввода кода | Пустые `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` или AUD не того приложения | Шаг 2.5–2.6, затем выкатить заново |
| Страница Access не пускает («not authorized») | Почты нет в политике | Шаг 2.3 |
| «Связь с Лорбуком и ЛавГеймс ещё не настроена на сервере» | Нет секрета в `masterboard` или lorebridge не выкачен | Шаги 3–4, затем выкатить Мастерборд |
| «Лорбук: …» / «ЛавГеймс: …» с отказом (403) | Почта входа не совпадает с почтой аккаунта в Лорбуке/ЛавГеймс | Входить той же почтой, что в этих системах |
| Ошибка при создании кампании | Нет таблиц | Шаг 1 |
| `wrangler deploy` ругается на `LOREBRIDGE` | Worker `lorebridge` не найден в этом аккаунте | Выкатить lorebridge (шаг 4) в тот же аккаунт |

---

## Бесплатные лимиты (для справки)

Workers — 100 000 запросов в сутки; D1 — 5 млн чтений и 100 000 записей в сутки, 5 ГБ; Access — до 50 пользователей бесплатно. Для команды мастеров этого с большим запасом хватает.
