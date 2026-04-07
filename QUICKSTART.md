# TokenMind Quickstart

## 1. Requirements

- Docker Desktop running
- Docker Compose v2
- Phantom wallet browser extension
- Phantom network set to Solana `devnet`

## 2. Start The Stack

Preferred development command:

```bash
make dev
```

Windows PowerShell alternative:

```powershell
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

Production containers without hot reload:

```bash
make prod
```

The repository already includes a local-safe root `.env`, so no extra copy step is required for the first launch.

## 3. Verify Startup

```bash
make status
```

Manual checks:

```bash
curl http://localhost:3000
curl http://localhost:8000/health
curl http://localhost:8000/docs
```

## 4. First User Flow

1. Open `http://localhost:3000`.
2. Connect Phantom.
3. Make sure Phantom is on Solana `devnet`.
4. Register at `/auth/register`.
5. Log in at `/auth/login`.
6. Submit KYC/KYS at `/marketplace/kyc`.

## 5. Local OTP Behavior

Some issuer and patent-submission flows use OTP.

- With real SMTP credentials, the code is emailed.
- Without SMTP credentials, the backend prints the OTP into the API logs.

Watch the OTP log here:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml logs -f api
```

## 6. Useful Commands

```bash
make logs
make logs-api
make ps
make down
make clean
make migrate
```

## 7. Troubleshooting

If the stack was started before these changes or the database schema looks stale, rebuild from scratch:

```bash
make clean
make dev
```

If you need production-style logs instead of the dev override:

```bash
docker compose logs -f api
docker compose logs -f frontend
```
