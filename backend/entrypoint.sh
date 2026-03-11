#!/bin/sh
# Ensure logs & data are writable
chmod -R a+rw /app/logs /app/data

# Execute the passed-in command
exec "$@"
