#!/bin/sh
# Ensure logs & data are writable
chmod -R a+rw /app/logs /app/data

# Debug: Print DATABASE_URL (masked for security)
if [ -n "$DATABASE_URL" ]; then
    # Mask password in URL for logging
    MASKED_URL=$(echo "$DATABASE_URL" | sed -E 's/:([^@]+)@/:****@/')
    echo "==> DATABASE_URL: $MASKED_URL"
else
    echo "==> ERROR: DATABASE_URL environment variable is not set!"
fi

# Execute the passed-in command
exec "$@"
