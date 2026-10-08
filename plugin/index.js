// ModelsDisabler — OpenCode V2 plugin.
//
// On startup it reads OpenCode's live model registry and keeps the built-in
// OpenCode Zen ("opencode") and OpenCode Go ("opencode-go") providers in a
// predictable state:
//
//   * free models stay enabled (price 0/0 in every tier, or an id ending in
//     "-free");
//   * paid models are disabled;
//   * an explicit allowlist keeps selected paid models — by default the ones
//     included in the OpenCode Go plan (DeepSeek V4.1 Flash, MiMo V2.6 Flash,
//     GLM-5.3 Flash).
//
// Providers added by the user (LocalAI, OpenRouter, ...) are never touched.
//
// The work is done with a model transform, so it is replayed automatically
// whenever the catalog is rebuilt (for example after a models.dev refresh).
// There is no background timer and no network access.

import { appendFileSync } from "node:fs"

const DEFAULT_PROVIDERS = ["opencode", "opencode-go"]

// Paid models that stay enabled anyway (in addition to every free model).
const DEFAULT_KEEP = {
  opencode: [],
  "opencode-go": ["deepseek-v4.1-flash", "mimo-v2.6-flash", "glm-5.3-flash"],
}

// Optional debug log file. Set MODELS_DISABLER_DEBUG to a path to enable.
const DEBUG_LOG = process.env.MODELS_DISABLER_DEBUG

function log(message) {
  console.log(`[models-disabler] ${message}`)
  if (!DEBUG_LOG) return
  try {
    appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${message}\n`)
  } catch {
    // Ignore debug write failures.
  }
}

// A model is free when its id is marked "-free" or every price tier is zero.
// Models without price data are "unknown" (see options.unknown).
function freeStatus(model) {
  if (/-free$/i.test(String(model?.id ?? ""))) return "free"

  const tiers = Array.isArray(model?.cost) ? model.cost : []
  if (tiers.length === 0) return "unknown"

  const allZero = tiers.every((tier) => {
    const input = Number(tier?.input)
    const output = Number(tier?.output)
    return (Number.isFinite(input) ? input : 0) === 0 && (Number.isFinite(output) ? output : 0) === 0
  })
  return allZero ? "free" : "paid"
}

function toIdSet(value) {
  const list = Array.isArray(value) ? value : []
  return new Set(list.filter((id) => typeof id === "string" && id.length > 0))
}

function buildKeep(options) {
  const merged = { ...DEFAULT_KEEP }
  const override = options && typeof options.keep === "object" ? options.keep : null
  if (override) {
    for (const [providerID, list] of Object.entries(override)) {
      merged[providerID] = Array.isArray(list) ? list : []
    }
  }
  const map = new Map()
  for (const [providerID, list] of Object.entries(merged)) {
    map.set(providerID, toIdSet(list))
  }
  return map
}

export default {
  id: "opencode.models-disabler",

  async setup(ctx) {
    const options = ctx.options ?? {}

    const providers =
      Array.isArray(options.providers) && options.providers.length > 0
        ? options.providers.map(String)
        : DEFAULT_PROVIDERS

    const keep = buildKeep(options)

    // What to do with a model that has no price data and is not marked "-free".
    // "disable" (default) is fail-closed: an unknown price is treated as paid.
    // "keep" is fail-open.
    const unknown = options.unknown === "keep" ? "keep" : "disable"

    const summary = new Map()

    let registration
    try {
      registration = await ctx.model.transform((editor) => {
        summary.clear()

        for (const providerID of providers) {
          const keepSet = keep.get(providerID) ?? new Set()
          const keepAll = keepSet.has("*")

          let models = []
          try {
            models = editor.list(providerID)
          } catch {
            // Provider is not present in this location; nothing to manage.
          }

          let disabled = 0
          let allowed = 0
          let free = 0

          for (const model of models) {
            const allowlisted = keepAll || keepSet.has(model.id)
            const status = freeStatus(model)

            let enabled
            if (allowlisted) {
              enabled = true
              allowed += 1
            } else if (status === "free") {
              enabled = true
              free += 1
            } else if (status === "paid") {
              enabled = false
              disabled += 1
            } else {
              // Unknown price.
              enabled = unknown === "keep"
              if (enabled) free += 1
              else disabled += 1
            }

            if (model.enabled !== enabled) {
              editor.update(providerID, model.id, (draft) => {
                draft.enabled = enabled
              })
            }
          }

          summary.set(providerID, { total: models.length, disabled, allowed, free })
        }
      })
    } catch (error) {
      log(`could not register the model transform: ${error}`)
      return
    }

    // Force one registry read so the transform runs and we can report.
    try {
      await ctx.model.list()
    } catch (error) {
      log(`could not read the model registry: ${error}`)
    }

    for (const providerID of providers) {
      const s = summary.get(providerID)
      if (!s) continue
      if (s.total === 0) {
        log(`${providerID}: no models found (provider absent here)`)
      } else {
        log(
          `${providerID}: kept ${s.free} free + ${s.allowed} allowlisted, disabled ${s.disabled} paid (of ${s.total})`,
        )
      }
    }

    return () => {
      void registration.dispose()
    }
  },
}
