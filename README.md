# NutriSnap

NutriSnap is an AI-powered nutrition tracking platform comprising a Next.js frontend (deployed via Docker) and a Python backend (Gemini API) that processes food images via Telegram.

## Architecture

1. **Frontend UI & Telegram Webhook (Next.js)**
   - Managed via Docker Compose: `docker compose up -d`
   - Location: `/opt/docker/containers/nutrisnap/NutriSnap`

2. **Image Analysis Backend (Python)**
   - Managed via native Linux systemd service for maximum CPU efficiency and stability.
   - Location: `/opt/docker/containers/vision-health-app/gemini-api/app.py`
   - Systemd Service: `gemini-api.service`

## Managing the Python Backend

The Python API has been configured as a permanent background service. It is set to automatically start when the server reboots.

- **Check Status:** `systemctl status gemini-api`
- **View Live Logs:** `journalctl -u gemini-api -f`
- **Restart Service:** `systemctl restart gemini-api`
- **Enable Auto-Start on Boot:** `systemctl enable gemini-api.service` (Already enabled)

## Managing the Database

When setting up NutriSnap on a fresh system (where the database is empty), you must sync the database schema.
If the database schema drifts or you get Prisma errors on startup, run the following command to forcefully push the schema:

```bash
docker compose exec nutrisnap npx prisma db push --accept-data-loss
```

*(Note: The `Dockerfile` has been updated to run this automatically on startup, but you can run it manually if you bypass the startup script).*

## Development Notes & Troubleshooting

### Background Workers & Next.js Builds
If you are developing or maintaining the Next.js app and adding background jobs (like `node-cron` used for Telegram reminders in `src/lib/scheduler.ts`), you **must** ensure they are skipped during the Next.js build phase.

Next.js `npm run build` generates static pages and runs `instrumentation.ts`. If `instrumentation.ts` initializes a long-running background worker (like `setInterval` or `cron`), the Node.js event loop will never empty, causing `npm run build` to hang forever at the `Collecting page data ...` step!

To fix this, we've added an `ENV IS_BUILDING=1` step to the Dockerfile right before the build command. Always check this in `src/instrumentation.ts`:

```typescript
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' && 
    process.env.IS_BUILDING !== '1' // <--- CRITICAL
  ) {
    const { startScheduler } = await import('./lib/scheduler');
    startScheduler();
  }
}
```
