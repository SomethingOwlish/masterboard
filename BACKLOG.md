# Бэклог

Собственное ТЗ (`docs/spec.md`) выполнено; сверка с кодом — 27.09.2026. Здесь — то, что
найдено при сверке и ждёт решения. Пункт берётся в работу только по решению.

## Сборка

### 1. `package-lock.json` не совпадает с `package.json`
`npm ci` падает (`Missing: esbuild@0.28.2 from lock file` — esbuild внутри vitest).
Если сборка на Cloudflare ставит зависимости через `npm ci`, деплой сломан. Лечится
`npm install` и коммитом lock-файла.

### 2. Предупреждения линтера
9 предупреждений `react-refresh/only-export-components` в пяти файлах
(`EntityDetails.tsx`, `useConfirm.tsx`, `useToast.tsx`, `useExternal.tsx`,
`useLocalCampaign.tsx`): вместе с компонентами оттуда экспортируются функции.
Ошибок нет.

## Код

### 3. Модули `src/storage/*`, которые продукт не использует
`campaignContentRepository`, `campaignDocuments`, `campaignRepository`, `entityLibrary`,
`publicationManager`, `sessionDocuments`, `sessionLifecycle`, а также
`adapters/memoryStorageGateway` — их импортируют только тесты. Это остатки первой
модели хранения; удалить или оставить — решение команды.

## Интеграции

### 4. Усиление входа моста (Р11)
Сейчас Worker Мастерборда ходит в lorebridge с общим секретом и почтой из Access.
По плану systemsetup (`isolated-migration-2026-09-27.md`, Р11) мост должен сам
проверять пропуск Access. Отдельный этап, затрагивает masterboard и lorebridge.

## Исключено

- **Открытие без сети** (решение 27.09.2026): правки при обрыве связи не теряются,
  запуск без сети упирается во вход через Access.
