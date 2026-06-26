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
