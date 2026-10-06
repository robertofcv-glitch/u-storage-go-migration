import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const expectedArchiveHash = "978a2a2e59e15156e7ee62e0c62ec366a63a44269fbe6f9fb4bc72822c06d097"
const archive = path.resolve("brand/source/U-Storage-Go-Brand-Package-v1.0.zip")
const archiveRoot = "U-Storage-Go-Brand-Package-v1.0"
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "usg-brand-"))

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

try {
  const archiveBuffer = await readFile(archive)
  if (sha256(archiveBuffer) !== expectedArchiveHash) {
    throw new Error("Brand package archive SHA-256 does not match brand/README.md")
  }

  const result = spawnSync("unzip", ["-qq", archive, "-d", temporaryDirectory], {
    encoding: "utf8",
  })
  if (result.status !== 0) throw new Error(result.stderr || "Unable to extract brand package")

  const extractedRoot = path.join(temporaryDirectory, archiveRoot)
  const manifest = JSON.parse(
    await readFile(path.join(extractedRoot, "00_Start-here/manifest.json"), "utf8"),
  )
  if (manifest.version !== "1.0" || manifest.files.length !== manifest.file_count_excluding_manifests) {
    throw new Error("Brand package manifest metadata is inconsistent")
  }

  const failures = []
  for (const entry of manifest.files) {
    const target = path.join(extractedRoot, entry.path)
    const info = await stat(target).catch(() => null)
    if (!info?.isFile()) {
      failures.push(`${entry.path}: missing`)
      continue
    }
    if (info.size !== entry.bytes) failures.push(`${entry.path}: size mismatch`)
    if (sha256(await readFile(target)) !== entry.sha256) failures.push(`${entry.path}: SHA-256 mismatch`)
  }
  if (failures.length) throw new Error(failures.join("\n"))

  console.log(`Brand Package v${manifest.version} validated (${manifest.files.length} files).`)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}