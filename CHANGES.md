# Изменения (незакоммичено)

## 0.2.0

- Muse Spark разблокирован в обоих провайдерах: `opencode/muse-spark-1.3`,
  `opencode/muse-spark-1.2`, `opencode-go/muse-spark-1.3-contributor`,
  `opencode-go/muse-spark-1.2-contributor` добавлены в allowlist по умолчанию.

## 0.1.0

- Первая версия плагина `opencode.models-disabler`.
- Отключает платные модели провайдеров `opencode` (Zen) и `opencode-go`,
  оставляя бесплатные (цена `0/0` или id `*-free`).
- Для `opencode-go` оставляет платные `deepseek-v4.1-flash`,
  `mimo-v2.6-flash`, `glm-5.3-flash` (allowlist, настраивается).
- Пользовательские провайдеры не затрагиваются.
- Работает через `ctx.model.transform` — без таймеров и сети.
