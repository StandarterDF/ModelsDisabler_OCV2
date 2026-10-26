# OpenCode_ModelsDisabler

> Плагин для OpenCode V2: при старте читает каталог моделей OpenCode и
> **отключает все платные модели OpenCode Zen / OpenCode Go**, оставляя
> бесплатные и явно разрешённые (подписочные) модели.

## Описание

Плагин заменяет ручной `disabled: true` в `opencode.json` и скрипт
`update-models.ps1`: при каждом запуске OpenCode он сам смотрит на живой
реестр моделей и приводит управляемые провайдеры к нужному виду.

**Возможности:**

- отключает все платные модели провайдеров `opencode` (OpenCode Zen) и
  `opencode-go` (OpenCode Go);
- оставляет включёнными бесплатные модели (цена `0/0` во всех тарифах или
  id, заканчивающийся на `-free`);
- для `opencode-go` дополнительно оставляет платные модели, входящие в
  подписку: `deepseek-v4.1-flash`, `mimo-v2.6-flash`, `glm-5.3-flash`;
- оставляет включёнными Muse Spark: `opencode/muse-spark-1.3`,
  `opencode/muse-spark-1.2`, `opencode-go/muse-spark-1.3-contributor`,
  `opencode-go/muse-spark-1.2-contributor`;
- **не трогает** провайдеров, добавленных пользователем (LocalAI, OpenRouter
  и т.п.);
- не имеет внешних зависимостей, не ходит в сеть и не держит таймеров:
  используется `ctx.model.transform`, который OpenCode сам переигрывает при
  перестройке каталога (например, после обновления models.dev);
- необязательный отладочный лог через переменную окружения
  `MODELS_DISABLER_DEBUG`.

## Требования

- OpenCode **V2**.
- Node.js **18+** (OpenCode уже включает его).

## Структура

```
ModelsDisabler_OCV2/
├── opencode.json          # пустой проектный конфиг (только $schema); плагин подключается глобально
├── install.bat            # установка плагина в глобальный каталог OpenCode (Windows)
├── plugin/
│   ├── index.js           # сам плагин (чистый JS, без внешних зависимостей)
│   └── package.json       # "type": "module"
├── README.md
├── CHANGES.md             # незакоммиченные изменения
├── AGENTS.md              # описание архитектуры проекта
└── LICENSE                # MIT
```

## Логика

Для каждого управляемого провайдера (`opencode`, `opencode-go`) плагин
перебирает модели и решает по каждой:

| Условие | Действие |
|---|---|
| id в списке `keep` (allowlist) | включить |
| id заканчивается на `-free` | включить |
| все тарифы цены `0/0` | включить |
| есть платный тариф | отключить |
| цены нет | зависит от `options.unknown` (по умолчанию отключить — fail-closed) |

Управляемые провайдеры по умолчанию:

| Провайдер | Название | `keep` по умолчанию |
|---|---|---|
| `opencode` | OpenCode Zen | — |
| `opencode-go` | OpenCode Go | `deepseek-v4.1-flash`, `mimo-v2.6-flash`, `glm-5.3-flash` |

Провайдеры, которых нет в списке `providers`, не изменяются вообще.

## Установка

Способы ниже равнозначны — выбери любой.

### Вариант 1. Автоматически, силами нейросети (рекомендуется)

Скопируй промт ниже и отправь его OpenCode. Агент сам установит плагин,
поправит конфиг, перезапустит сервис и проверит результат.

```text
Установи мне плагин OpenCode V2 ModelsDisabler из репозитория
UMODELS_URL (замени URL на свой форк, если он у тебя другой).

Что нужно сделать:
1. Определи каталог глобального конфига OpenCode:
   - Windows: %USERPROFILE%\.config\opencode  (или %XDG_CONFIG_HOME%\opencode)
   - Linux/macOS: ~/.config/opencode  (или $XDG_CONFIG_HOME/opencode)
   Каталог глобальных плагинов — <config>/plugins/.
2. Установи плагин: скопируй содержимое папки plugin/ репозитория
   (index.js и package.json) в <config>/plugins/models-disabler/.
   Либо выполни: opencode plugin add 'github:StandarterDF/OpenCode_ModelsDisabler#main::path:plugin'
3. (Необязательно, но желательно) В <config>/opencode.json удали блоки
   "models" с "disabled": true у провайдеров "opencode" и "opencode-go" —
   теперь их ведёт плагин.
4. Перезапусти сервис: opencode service restart
5. Проверь работу: выставь MODELS_DISABLER_DEBUG в путь к лог-файлу,
   выполни opencode run "reply with OK" и покажи мне строки лога вида:
   [models-disabler] opencode-go: kept ... free + ... allowlisted, disabled ... paid (of ...)
   Если платных моделей не отключилось — продиагностируй причину и доведи
   установку до конца.

Действуй автономно, лишних вопросов не задавай. В конце кратко отчитайся: что
установил, какие файлы изменил, сколько моделей отключено.
```

### Вариант 2. Одной командой через CLI

Если репозиторий опубликован на GitHub:

```bash
opencode plugin add 'github:StandarterDF/OpenCode_ModelsDisabler#main::path:plugin'
```

CLI сам скачает пакет, установит его и добавит запись в конфиг. После этого
перезапусти сервис:

```bash
opencode service restart
```

### Вариант 3. Вручную (Windows)

Запусти из корня репозитория:

```bat
install.bat
```

Скрипт скопирует `plugin/` в
`%USERPROFILE%\.config\opencode\plugins\models-disabler\`.

Для Linux / macOS глобальный путь — `~/.config/opencode/plugins/models-disabler/`.

### Вариант 4. Только для одного проекта

Положи плагин в проект и подключи его проектной конфигурацией:

- создай `<project>/.opencode/plugins/models-disabler/` с файлами `index.js` и
  `package.json` — OpenCode подхватит такой каталог автоматически;

  **или**

- положи каталог рядом и укажи его явно в `<project>/opencode.json`:

  ```jsonc
  {
    "$schema": "https://opencode.ai/config.json",
    "plugins": ["./plugin"]
  }
  ```

## Настройка

### Параметры плагина (`ctx.options`)

Параметры передаются объектной формой в `opencode.json`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "./plugin",
      "options": {
        "providers": ["opencode", "opencode-go"],
        "keep": {
          "opencode-go": ["deepseek-v4.1-flash", "mimo-v2.6-flash", "glm-5.3-flash"]
        },
        "unknown": "disable"
      }
    }
  ]
}
```

| Опция | По умолчанию | Описание |
|---|---|---|
| `providers` | `["opencode", "opencode-go"]` | Какие провайдеры ведёт плагин. |
| `keep` | см. таблицу выше | Карта `providerID -> [modelID...]` платных моделей, которые остаются включёнными. Значение `"*"` — оставить всё. Указанный провайдер **заменяет** свой дефолтный список, остальные сохраняются. |
| `unknown` | `"disable"` | Что делать с моделью без данных о цене: `"disable"` (считать платной) или `"keep"`. |

### Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `MODELS_DISABLER_DEBUG` | — | Путь к файлу, куда пишется отладочный лог. Если не задана — лог идёт только в stdout. |

## Проверка

Запусти OpenCode с включённым отладочным логом:

```powershell
# Windows (PowerShell)
$env:MODELS_DISABLER_DEBUG="$PWD\models-disabler-debug.log"; opencode run "reply with OK"
```

```bash
# Linux / macOS
MODELS_DISABLER_DEBUG="$PWD/models-disabler-debug.log" opencode run "reply with OK"
```

В логе должны появиться строки вида:

```
[models-disabler] opencode: kept 24 free + 0 allowlisted, disabled 70 paid (of 94)
[models-disabler] opencode-go: kept 2 free + 3 allowlisted, disabled 30 paid (of 35)
```

Если строк нет или что-то не так, проверь по порядку:

1. Плагин действительно загружен: при старте в логе OpenCode есть запись
   `[models-disabler] ...`.
2. В `providers` указаны правильные id (`opencode`, `opencode-go`).
3. Модель не входит в `keep`, не заканчивается на `-free` и имеет ненулевую
   цену — значит, она и должна быть отключена.
4. Проверь результат: `/models` не должен показывать платные модели Zen/Go,
   кроме разрешённых.

## Удаление

1. Убери запись плагина из `opencode.json` (при установке через CLI —
   `opencode plugin remove ...`).
2. Удали каталог `<config>/plugins/models-disabler/` (или
   `<project>/.opencode/plugins/models-disabler/`).
3. Перезапусти сервис: `opencode service restart`.

## Ссылки

- [Документация OpenCode V2 — плагины](https://opencode.ai/v2/docs/build/plugins)
- [Конфигурация плагинов OpenCode V2](https://opencode.ai/v2/docs/plugins)
- [OpenCode V2](https://opencode.ai/v2/docs/)

## Лицензия

MIT — см. [LICENSE](LICENSE).
