#!/bin/bash
set -e

echo "Starting OpenBB Backend Services..."
echo "=================================="

echo "Step 1: Initializing database..."
if python init-db.py; then
    echo "✅ Database initialization completed successfully"
else
    echo "❌ Database initialization failed"
    exit 1
fi

echo ""
echo "Step 2: Running database migrations..."
if alembic upgrade head; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed"
    exit 1
fi

echo ""
echo "Step 3: Adding initial data..."
if python -m scripts.init_users; then
    echo "✅ Initial data setup completed successfully"
else
    echo "⚠️  Initial data setup failed, but continuing..."
fi

echo ""
echo "Step 4: Starting supervisor..."
echo "✅ All initialization steps completed. Starting application services..."
exec supervisord -c backend_supervisord.conf
