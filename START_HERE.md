# U-Storage Go migration — start here

This is a clean snapshot of the original project, not its complete Git history.
The original project, live deployment and domain must remain in place until the
new deployment and final database synchronization have been verified.

## Safety gate

The imported project is configured to run `scripts/migration-gate.mjs` initially,
not the actual application. This avoids accidental startup seeding, duplicated
background jobs or outbound messages during import.

The original `.replit` configuration is saved as `.replit.original`.
Do not restore it or start `npm run dev` until the database and outbound services
are ready. Do not publish the new project or change DNS yet.

## What's included

- Website source, build configuration, dependency lockfile and runtime assets.
- Full production database snapshot in `.migration/database.dump.enc`.
- Supporting files (original brand sources, attached media, project notes,
  screenshots, exported QR assets and private production configuration) in the
  encrypted `.migration/supporting-files.tar.gz.enc.part-*` files.
- `.migration/manifest.json` records sizes and hashes.

All database records/configuration are preserved in the encrypted dump. Secrets
and connected-service authorizations are not in GitHub; reconnect/configure them
securely in the destination workspace.

## Decrypt in the new project only

Add `MIGRATION_BACKUP_PASSPHRASE` through the new project's Secrets tool. Use the
same passphrase as the original project. Never paste it into chat or commit it.

The following commands decrypt files but do not modify any database:

```sh
mkdir -p .migration-private
node scripts/migration-archive.mjs decrypt \
  .migration/database.dump.enc .migration-private/production.dump
cat .migration/supporting-files.tar.gz.enc.part-* > \
  .migration-private/supporting-files.tar.gz.enc
node scripts/migration-archive.mjs decrypt \
  .migration-private/supporting-files.tar.gz.enc \
  .migration-private/supporting-files.tar.gz
```

Check SHA-256 values against the manifest before extracting:

```sh
sha256sum .migration-private/production.dump \
  .migration-private/supporting-files.tar.gz
tar -tzf .migration-private/supporting-files.tar.gz
```

Have the destination Agent review the manifest, extraction paths and the new
project's database target before proceeding. Extracting these files restores
the supporting material, including private configuration; keep it out of future
Git commits and do not publish it as static content.

## Restore checkpoint — stop and verify the target

Restore the dump into this NEW project's DEVELOPMENT database, not the original
production database. Never run a destructive restore against the old database.
If the destination database already contains data, review it before any restore.
Replit-managed production schema changes must use the supported Publish flow,
not custom production migration scripts.

After restore, compare record counts, critical settings and recent quotes against
the source. Test login/customer/mover/admin roles, quote flow, `/QR`, files and
services. Confirm outbound messages/payments/workers cannot run twice.

This is an initial live snapshot: the old website may receive newer records.
A final coordinated write pause and data synchronization is required before
the domain cutover. Do not treat this archive as the final cutover snapshot.

## Permanent address

The QR destination must remain `https://u-storage-go.com.mx/QR`.
Only reconnect the custom domain after the new deployment has passed checks.
Keep the old project and backups available for recovery.
