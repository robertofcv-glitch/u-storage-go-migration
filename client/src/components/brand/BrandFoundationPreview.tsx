import { UsgIcon } from "./UsgIcon"

/**
 * Focused visual fixture for validating theme-aware brand icons.
 * It intentionally renders the same icons on the two approved surface modes.
 */
export function BrandFoundationPreview() {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2">
      <section
        aria-label="Calm icon preview"
        className="flex items-center gap-4 rounded-[var(--card-radius)] bg-[var(--calm-surface)] p-6 text-[var(--calm-text)]"
      >
        <UsgIcon name="truck" label="Mudanza" />
        <UsgIcon name="storage" label="Almacenamiento" />
        <UsgIcon name="shield" label="Protección" />
      </section>
      <section
        aria-label="Bold icon preview"
        className="flex items-center gap-4 rounded-[var(--card-radius)] bg-[var(--bold-surface)] p-6 text-[var(--bold-text)]"
      >
        <UsgIcon name="truck" label="Mudanza" />
        <UsgIcon name="storage" label="Almacenamiento" />
        <UsgIcon name="shield" label="Protección" />
      </section>
    </div>
  )
}