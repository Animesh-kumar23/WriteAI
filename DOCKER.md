# Docker, kept simple

You only need these ideas:

- An **image** is a packaged copy of WriteAI.
- A **container** is that image running.
- `docker compose` starts WriteAI, MongoDB, and the required Redis service together.
- AWS runs the same image, but your production database stays in MongoDB Atlas.

## Try it locally

Install Docker Desktop, then run these commands from the project root:

```powershell
Copy-Item .env.example .env
```

Put real values for `JWT_SECRET_KEY` and `GEMINI_API_KEY` in `.env`, then run:

```powershell
docker compose up --build
```

Open <http://localhost:3000>. Stop it with `Ctrl+C`, followed by:

```powershell
docker compose down
```

The bundled MongoDB service does not implement Atlas Search. The rest of the local
stack works normally, but search intentionally fails unless `DB_URI` points to an
Atlas database with the indexes documented in [README.md](README.md#atlas-search-indexes).

Your local MongoDB, Redis, and uploaded-file data survive normal restarts. To delete
that local Docker data too, run `docker compose down -v`.

## Deploy on one free-tier EC2 instance

Use one small EC2 virtual machine. There is no ECS, ECR, load balancer, or
Kubernetes in this path. Follow **[DEPLOY.md](DEPLOY.md)** for the exact beginner
steps.

The production database should remain in MongoDB Atlas; do not run the local
MongoDB container from `docker-compose.yml` on the small EC2 instance.
