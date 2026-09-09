set -e


echo ""
echo "Step 1: Running database migrations..."
if alembic upgrade head; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed"
    exit 1
fi


echo ""
echo "Step 2: Starting supervisor..."
echo "✅ All initialization steps completed. Starting application services..."
exec supervisord -c supervisord_api.conf
