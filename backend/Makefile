.PHONY: install run seed migrate docker-up docker-down

install:
	python -m venv .venv
	. .venv/bin/activate && pip install -r requirements.txt

run:
	uvicorn app.main:app --reload

seed:
	python scripts/seed_db.py

# Applies a specific migration file to the running local Postgres container.
# Usage: make migrate FILE=migrations/0002_add_xyz.sql
migrate:
	docker exec -i smart_cab_postgres psql -U postgres -d smart_cab_db < $(FILE)

docker-up:
	docker compose -f ../docker-compose.yml up -d

docker-down:
	docker compose -f ../docker-compose.yml down
