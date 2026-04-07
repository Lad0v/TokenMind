# TokenMind

TokenMind is a full-stack IP tokenization platform built with Next.js, FastAPI, PostgreSQL, Redis, MinIO, and Solana wallet authentication.

## Clone To Run

The repository now includes a safe local `.env`, so a fresh clone can be started without creating extra config files.

```bash
git clone <repository-url>
cd TokenMind-main
make dev
```

If `make` is unavailable on Windows, run:

```powershell
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

On the first start Docker will build the images, create PostgreSQL/Redis/MinIO volumes, and run Alembic migrations automatically.

## What Judges Need

- Docker Desktop with Compose v2
- Phantom wallet extension
- Phantom set to Solana `devnet`
- Some devnet SOL in the connected wallet for on-chain actions

## Main URLs

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Backend health: `http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Judge Flow

1. Open `http://localhost:3000`.
2. Connect Phantom on Solana `devnet`.
3. Register at `/auth/register` with email plus the connected wallet.
4. Log in at `/auth/login` using the same wallet.
5. Complete KYC/KYS at `/marketplace/kyc`.
6. Explore the issuer workspace at `/issuer` and the marketplace at `/marketplace`.

## OTP In Local Runs

Issuer-related flows can request OTP delivery.

- If SMTP credentials are configured, TokenMind sends a real email OTP.
- If SMTP credentials are empty, the backend logs the OTP code instead of failing the flow.

To see the OTP in local Docker mode:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml logs -f api
```

## Commands

- `make dev` starts the full stack with hot reload.
- `make prod` starts the production containers.
- `make down` stops the stack.
- `make clean` removes containers and volumes.
- `make logs` tails development logs.
- `make logs-api` tails backend logs.
- `make ps` shows container status.
- `make migrate` runs migrations manually.
- `make status` checks core health endpoints.

## Environment Notes

- The committed root `.env` is intended only for local or hackathon use.
- `.env.example` mirrors the same structure for teams that want their own local override.
- Before any real deployment, replace the default secrets, passwords, and SMTP settings.

## Stack

- Frontend: Next.js 16, React 19, TypeScript
- Backend: FastAPI, SQLAlchemy, Alembic
- Data layer: PostgreSQL 16, Redis 7, MinIO
- Wallet/auth: Phantom wallet, Solana `devnet`

## Additional Docs

- [QUICKSTART.md](QUICKSTART.md)
- [backend/architecture.md](backend/architecture.md)
- [backend/IP_INTEL_MODULE.md](backend/IP_INTEL_MODULE.md)

## License

MIT. See [LICENSE](LICENSE).
