#!/bin/sh
set -e

echo "Starting Smart Cab Booking System API..."
# PORT is provided by most hosts (Render, Railway, ...); default to 8000 locally.
# --forwarded-allow-ips="*" lets uvicorn trust the host's reverse proxy, so
# request.client is the real visitor IP (the login rate limiter keys on it)
# instead of the proxy's IP shared by every user.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" \
  --proxy-headers --forwarded-allow-ips="*"