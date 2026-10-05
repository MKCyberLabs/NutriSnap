# NutriSnap Database Setup & Deployment Guide

This guide covers development containers, schema updates, admin seeding, and database backups. Schema updates can run in a temporary Docker container; the seed script runs from a checkout with Node.js dependencies installed.

## 🚀 Rapid Development Workflow (Hot-Reload)

When you are actively editing code (changing UI, testing components), do **NOT** use `docker-compose up -d --build`. That command is for Production and takes a long time to optimize and minify files.

Instead, use the dedicated Development Environment:

```bash
# 1. Stop your production containers if they are running
docker-compose down

# 2. Start the instant hot-reload development server
docker-compose -f docker-compose.dev.yml up
```

This will run Next.js in `dev` mode and mount your live files. Now, whenever you press "Save" in your editor, your browser will update instantly in milliseconds!

---

## 1. Initializing the Production Container

First, ensure your Docker network and database container are running. NutriSnap utilizes a shared Docker network (e.g., `proxy`) to allow the Next.js container to communicate with the DB.

```bash
# Start the database container in detached mode
docker-compose up -d db
```

## 2. Syncing the ORM & Applying Migrations (Prisma Schema Push)

When moving to a new system or anytime you add a new table, column, or relationship to `prisma/schema.prisma`, you **must** apply these changes to the Postgres database. Failing to do so will result in silent ORM failures (e.g. `P2022: The column X does not exist`).

Instead of installing Node modules locally, run a temporary Node container attached to the Docker network. This container securely passes the internal database URL and executes `prisma db push`:

```bash
docker run --rm --env-file .env -v $(pwd)/prisma:/prisma -w /prisma \
  --network proxy \
  node:18-alpine sh -c "npm install prisma && npx prisma db push --schema=/prisma/schema.prisma"
```
*(Make sure to adjust the `--network` flag if your docker-compose file uses a different internal network name).*

## 3. Seeding the Database (Super Admin)

Set a unique `ADMIN_INITIAL_PASSWORD` in your ignored `.env` file, then run `npx tsx prisma/seed.ts` from a checkout with dependencies installed. The seed script hashes the password and skips an existing admin. Never use a published example password for an admin account.

## 4. Exporting & Backing Up (Docker CLI)

To create a complete backup (SQL dump) of your NutriSnap database including all users, meal logs, and schemas:

```bash
docker exec -t nutrisnap_db pg_dump -U nutrisnap -d nutrisnap -c > nutrisnap_backup.sql
```

## 5. Restoring a Backup

To restore data from your exported `.sql` file into the database:

```bash
cat nutrisnap_backup.sql | docker exec -i nutrisnap_db psql -U nutrisnap -d nutrisnap
```

> **Warning:** Using `-c` in `pg_dump` drops existing tables before recreating them. Make sure you intend to overwrite the target database when restoring!
