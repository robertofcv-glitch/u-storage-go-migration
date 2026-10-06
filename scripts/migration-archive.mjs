import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { randomBytes, scryptSync, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import assert from "node:assert/strict";

// Format: magic(8), salt(16), nonce(12), ciphertext, authentication tag(16).
const MAGIC = Buffer.from("USGMIG01");
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const password = process.env.MIGRATION_BACKUP_PASSPHRASE;
if (!password || password.length < 12) {
  throw new Error("Set MIGRATION_BACKUP_PASSPHRASE in Secrets to a passphrase of at least 12 characters.");
}
const [operation, input, output] = process.argv.slice(2);
if (!["encrypt", "decrypt", "verify"].includes(operation) || !input || !output) {
  throw new Error("Usage: node scripts/migration-archive.mjs encrypt|decrypt|verify INPUT OUTPUT");
}
async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
if (operation === "encrypt") {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const header = Buffer.concat([MAGIC, salt, nonce]);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(password, salt, 32, options), nonce);
  cipher.setAAD(header);
  const handle = await fs.open(output, "wx", 0o600);
  await handle.writeFile(header);
  await handle.close();
  await pipeline(createReadStream(input), cipher, createWriteStream(output, { flags: "a", mode: 0o600 }));
  await fs.appendFile(output, cipher.getAuthTag());
  console.log(`Encrypted ${input} to ${output}`);
} else {
  const handle = await fs.open(input, "r");
  const size = (await handle.stat()).size;
  assert.ok(size >= 52, "Archive is incomplete.");
  const header = Buffer.alloc(36);
  const tag = Buffer.alloc(16);
  await handle.read(header, 0, 36, 0);
  await handle.read(tag, 0, 16, size - 16);
  await handle.close();
  assert.ok(header.subarray(0, 8).equals(MAGIC), "Wrong archive format.");
  const decipher = createDecipheriv("aes-256-gcm",
    scryptSync(password, header.subarray(8, 24), 32, options), header.subarray(24, 36));
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  if (operation === "verify") {
    const hash = createHash("sha256");
    await pipeline(createReadStream(input, { start: 36, end: size - 17 }), decipher,
      new Writable({ write(chunk, _encoding, done) { hash.update(chunk); done(); } }));
    assert.equal(hash.digest("hex"), await hashFile(output), "Decrypted content differs from the original.");
    console.log("PASS: authenticated decryption matches original SHA-256.");
  } else {
    const temp = `${output}.partial`;
    try {
      await pipeline(createReadStream(input, { start: 36, end: size - 17 }), decipher,
        createWriteStream(temp, { flags: "wx", mode: 0o600 }));
      // Do not expose unauthenticated output as a valid backup.
      await fs.link(temp, output);
      await fs.unlink(temp);
      console.log(`Decrypted and authenticated ${output}`);
    } catch (error) {
      await fs.unlink(temp).catch(() => {});
      throw error;
    }
  }
}
