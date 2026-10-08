# AGENTS.md — архитектура OpenCode_ModelsDisabler

## Назначение

Плагин OpenCode V2, который при загрузке читает живой каталог моделей
OpenCode (`ctx.model`) и приводит провайдеры OpenCode Zen (`opencode`) и
OpenCode Go (`opencode-go`) к нужному виду: платные модели — отключены,
бесплатные и разрешённые (подписочные) — включены. Провайдеры, добавленные
пользователем, не изменяются.

Плагин заменяет статический `disabled: true` в `opencode.json` и скрипт
`update-models.ps1`.

## Файлы

| Файл | Роль |
|---|---|
| `plugin/index.js` | Сам плагин. Экспортирует объект с `id` и `setup(ctx)`. Внешних зависимостей нет. |
| `plugin/package.json` | `"type": "module"` — обязательно, т.к. `index.js` использует ESM `import`. |
| `opencode.json` | Тестовый конфиг проекта: `"plugins": ["./plugin"]`. |
| `install.bat` | Копирует `plugin/` в глобальный каталог плагинов OpenCode (Windows). |
| `README.md` | Описание, установка, настройка, проверка. |
| `CHANGES.md` | Незакоммиченные изменения. |
| `AGENTS.md` | Этот файл. |
| `LICENSE` | MIT. |

## Точка входа

`plugin/index.js` экспортирует по умолчанию:

```js
export default {
  id: "opencode.models-disabler",
  async setup(ctx) { ... return cleanup }
}
```

OpenCode вызывает `setup(ctx)` при загрузке плагина. Возвращаемая функция
вызывается при выгрузке и делает `registration.dispose()`.

## Поток данных

1. `setup(ctx)` читает `ctx.options` (`providers`, `keep`, `unknown`) и
   строит `Map<providerID, Set<modelID>>` из дефолтного списка и override.
2. Регистрируется `ctx.model.transform(callback)`. Callback синхронный и
   повторяемый: для каждого управляемого провайдера перебирает
   `editor.list(providerID)` и по каждой модели решает, должна ли она быть
   включена (см. «Логика», раздел ниже).
3. Если фактическое `model.enabled` не совпадает с желаемым — вызывается
   `editor.update(providerID, modelID, draft => draft.enabled = ...)`.
4. Один раз выполняется `await ctx.model.list()`, чтобы OpenCode переиграл
   transform и заполнил сводку; сводка пишется в лог через `log()`.
5. Таймеров нет: OpenCode сам переигрывает transform при каждой перестройке
   реестра (перезагрузка провайдеров, обновление models.dev).

## Логика

`freeStatus(model)` возвращает одно из:

- `"free"` — id заканчивается на `-free` **или** во всех тарифах `cost`
  `input === 0` и `output === 0`;
- `"paid"` — есть хотя бы один тариф с `input > 0` или `output > 0`;
- `"unknown"` — у модели нет данных о цене.

Решение по модели:

| Условие | `enabled` |
|---|---|
| id в `keep` (или `keep` содержит `"*"`) | `true` |
| `freeStatus === "free"` | `true` |
| `freeStatus === "paid"` | `false` |
| `freeStatus === "unknown"` | `options.unknown === "keep"` (по умолчанию `false`) |

## Ключевые функции (`plugin/index.js`)

| Функция | Назначение |
|---|---|
| `log(message)` | Пишет в `console.log` и (если задан `MODELS_DISABLER_DEBUG`) в файл. |
| `freeStatus(model)` | Классифицирует модель как free/paid/unknown по id и `model.cost`. |
| `toIdSet(value)` | Приводит массив id к `Set`, отбрасывая пустое. |
| `buildKeep(options)` | Мержит `DEFAULT_KEEP` с `options.keep` в `Map<providerID, Set>`. |

## Настройки (константы в `plugin/index.js`)

| Константа | Значение | Смысл |
|---|---|---|
| `DEFAULT_PROVIDERS` | `["opencode", "opencode-go"]` | Управляемые провайдеры. |
| `DEFAULT_KEEP` | `opencode-go` → три flash-модели | Платные модели, которые остаются включёнными. |

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `MODELS_DISABLER_DEBUG` | Путь к файлу отладочного лога. Если не задана — лог только в stdout. |

## Внешние зависимости

Нет. Используются только встроенные средства Node.js (`node:fs`) и
plugin-context OpenCode: `ctx.options`, `ctx.model.transform`,
`ctx.model.list`.

## Архитектурные ограничения

- Плагин **только** выставляет `enabled`; он не удаляет модели и не меняет их
  стоимость/лимиты. Поэтому он совместим с плагином автоопределения контекста
  (`localai.dynamic-context`), который правит `limit.context`.
- Управляются только провайдеры из `providers`. Чужие провайдеры не
  перебираются вообще.
- Плагин не ходит в сеть: источник данных — реестр OpenCode (models.dev +
  провайдеры), а не `https://models.dev` напрямую.
