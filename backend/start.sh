#!/bin/sh
set -e

echo "Starting Smart Cab Booking System API..."
uvicorn app.main:app --host 0.0.0.0 --port 8000
