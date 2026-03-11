# WRRIC System Setup and Run Guide

This document provides instructions for setting up and running the WRRIC system, which consists of a FastAPI backend and a Next.js frontend.

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- `pg_dump` utility (for database schema management)

## Backend Setup (FastAPI)

1.  **Navigate to the backend directory**:
    ```bash
    cd backend
    ```

2.  **Create a virtual environment**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies**:
    ```bash
    pip install -r ../requirements.txt
    ```

4.  **Configure environment variables**:
    Update the `.env` file in the `backend` directory with your database credentials and API keys.

5.  **Run the backend**:
    ```bash
    uvicorn main:app --reload
    ```

## Frontend Setup (Next.js)

1.  **Navigate to the frontend directory**:
    ```bash
    cd frontend
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure environment variables**:
    Update the `.env` file in the `frontend` directory.

4.  **Run the development server**:
    ```bash
    npm run dev
    ```

## Database Schema

A schema dump is provided in `schema_dump.sql` at the root of the project. You can restore it using:
```bash
psql -h localhost -U your_username -d your_database -f schema_dump.sql
```

## Additional Notes
- Ensure PostgreSQL is running before starting the backend.
- The default backend API documentation is available at `http://localhost:8000/docs`.
