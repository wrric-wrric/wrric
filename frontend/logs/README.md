# Logs Directory

This directory contains application logs generated during runtime.

## Structure

```
logs/
├── error.log          # Error logs
├── combined.log       # Combined logs (all levels)
├── access.log         # HTTP access logs
└── debug.log          # Debug logs (development only)
```

## Important Notes

- **Do not commit log files** - they are automatically generated
- Log files are gitignored by default
- Only `.gitkeep` and `README.md` are tracked
- Logs rotate automatically to prevent disk space issues

## Log Levels

- `error`: Error events
- `warn`: Warning events  
- `info`: Informational messages
- `http`: HTTP requests
- `debug`: Detailed debug information (dev only)

