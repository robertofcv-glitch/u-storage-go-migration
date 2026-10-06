import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const runtimeRoot = path.join(root, "client/public/brand/v1")
const obsoleteColors = ["#ef7521", "#502864", "#1a1a1a"]
const baseline = JSON.parse(
  await readFile(path.join(root, "brand/legacy-color-baseline.json"), "utf8"),
)

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  }))).flat()
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/")
}

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => {
    const channel = Number.parseInt(value, 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a, b) {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (bright + 0.05) / (dark + 0.05)
}

const requiredAssets = [
  "fonts/montserrat-variable.woff2",
  "fonts/montserrat-italic-variable.woff2",
  "fonts/montserrat-regular.ttf",
  "fonts/montserrat-semibold.ttf",
  "logos/official-color.svg",
  "logos/official-reverse.svg",
  "favicons/favicon.svg",
  "favicons/icon-192.png",
  "favicons/icon-512.png",
  "icons/outline/truck.svg",
  "icons/duotone/storage.svg",
]

const errors = []
for (const asset of requiredAssets) {
  const info = await stat(path.join(runtimeRoot, asset)).catch(() => null)
  if (!info?.isFile() || info.size === 0) errors.push(`Missing runtime asset: ${asset}`)
}

const favicon = await readFile(path.join(runtimeRoot, "favicons/favicon.svg"), "utf8")
if ((favicon.match(/\sxmlns=/g) ?? []).length !== 1) {
  errors.push("Runtime SVG favicon must declare exactly one XML namespace")
}

const iconComponent = await readFile(
  path.join(root, "client/src/components/brand/UsgIcon.tsx"),
  "utf8",
)
if (!iconComponent.includes("<use") || !iconComponent.includes("sprite.svg#usg-")) {
  errors.push("Outline UsgIcon must use the currentColor SVG sprite")
}

const iconPreview = await readFile(
  path.join(root, "client/src/components/brand/BrandFoundationPreview.tsx"),
  "utf8",
)
if (!iconPreview.includes("--calm-surface") || !iconPreview.includes("--bold-surface")) {
  errors.push("Brand icon preview must cover Calm and Bold surfaces")
}

const textFiles = (await walk(path.join(root, "client/src")))
  .filter((file) => /\.(css|html|js|jsx|ts|tsx)$/.test(file))
textFiles.push(path.join(root, "client/index.html"))

for (const file of textFiles) {
  const name = relative(file)
  const source = (await readFile(file, "utf8")).toLowerCase()
  for (const color of obsoleteColors) {
    const count = source.split(color).length - 1
    const permitted = baseline[name]?.[color] ?? 0
    if (count > permitted) {
      errors.push(`${name} adds ${count - permitted} obsolete brand color use(s) of ${color}`)
    }
  }
  const whiteOnOrange = source.match(/bg-(?:primary|orange[^\s"']*)[^"'\\n]*text-white|text-white[^"'\\n]*bg-(?:primary|orange)/g)?.length ?? 0
  const permittedWhiteOnOrange = baseline[name]?.["white-on-orange"] ?? 0
  if (whiteOnOrange > permittedWhiteOnOrange) {
    errors.push(`${name} adds ${whiteOnOrange - permittedWhiteOnOrange} prohibited white-on-orange control(s)`)
  }
}

const combinations = [
  ["light action button", "#24152e", "#ff6c00", 4.5],
  ["light secondary button", "#fbf9f6", "#4e2069", 4.5],
  ["light link and emphasis", "#4e2069", "#fbf9f6", 4.5],
  ["light input text", "#24152e", "#ffffff", 4.5],
  ["light input placeholder", "#6d6075", "#ffffff", 4.5],
  ["light focus indicator", "#4e2069", "#fbf9f6", 3],
  ["light error status", "#ffffff", "#a52b3b", 4.5],
  ["light success status", "#ffffff", "#1e6b50", 4.5],
  ["dark action button", "#24152e", "#ff6c00", 4.5],
  ["dark link and emphasis", "#fbf9f6", "#24152e", 4.5],
  ["dark input text", "#fbf9f6", "#3f2450", 4.5],
  ["dark input placeholder", "#d9d0df", "#3f2450", 4.5],
  ["dark focus indicator", "#ff6c00", "#24152e", 3],
  ["dark error status", "#ffffff", "#a52b3b", 4.5],
  ["dark success status", "#ffffff", "#1e6b50", 4.5],
  ["Calm outline icon", "#24152e", "#fbf9f6", 3],
  ["Bold outline icon", "#fbf9f6", "#4e2069", 3],
]
for (const [name, foreground, background, minimum] of combinations) {
  const ratio = contrast(foreground, background)
  if (ratio < minimum) errors.push(`${name} contrast ${ratio.toFixed(2)} is below ${minimum}`)
}

if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log(`Brand foundation checks passed (${requiredAssets.length} assets, ${combinations.length} contrast pairs).`)