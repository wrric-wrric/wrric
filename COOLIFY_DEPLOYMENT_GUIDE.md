# Deploying wrric-system on Coolify VPS

This guide provides step-by-step instructions for deploying the wrric-system (backend + frontend) on a VPS using [Coolify](https://coolify.io/).

## Prerequisites

1. A VPS with at least **4GB RAM** (recommended 8GB for AI features)
2. **Coolify** installed on your VPS
3. A domain name (optional, but recommended)
4. PostgreSQL database (can be hosted separately or via Coolify)

---

## Step 1: Prepare Your Environment Variables

Create a `.env` file in the `backend/` directory with all required variables:

```bash
# Database Configuration
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/wrric

# JWT Secret (generate a secure random string)
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this

# Application URLs
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://api.your-domain.com

# OAuth Providers (optional - only if using social login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# AI API Keys (optional - for enhanced features)
GROQ_API_KEY=your-groq-api-key
GEMINI_API_KEY=your-gemini-api-key

# File Storage (Backblaze B2 - optional)
B2_KEY_ID=your-b2-key-id
B2_KEY_NAME=your-b2-key-name
B2_BUCKET_NAME=your-bucket-name

# Admin User (initial admin account)
ADMIN_EMAIL=admin@wrric.org
ADMIN_PASSWORD=your-admin-password
```

---

## Step 2: Set Up PostgreSQL Database

### Option A: Using Coolify's PostgreSQL (Recommended)

1. In Coolify dashboard, go to **Resources** → **Add New Resource**
2. Select **PostgreSQL**
3. Configure:
   - Name: `wrric-db`
   - Database name: `wrric`
   - User: `postgres`
   - Password: `your-secure-password`
4. Click **Deploy**

### Option B: Using Docker Compose (included in project)

The backend already has a `docker-compose.yml`. Modify it to include PostgreSQL:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
      POSTGRES_DB: wrric
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:your_password@db:5432/wrric
    depends_on:
      - db
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## Step 3: Deploy Backend (FastAPI)

### Method A: Using Coolify's "Deploy" feature (Git-based)

1. In Coolify dashboard:
   - Go to **Projects** → **Create New Project**
   - Name it `wrric-system`
   - Click **Add New Resource** → **Application**
   
2. Configure:
   - Name: `wrric-backend`
   - Git Repository: `https://github.com/wrric-wrric/wrric.git`
   - Branch: `main`
   - Build Pack: `Dockerfile`
   - Build Command: Leave default
   - Start Command: Leave default (from Dockerfile)

3. **Port**: Set to `8000`

4. **Environment Variables**: Add all variables from Step 1

5. **Volumes** (optional - for persistent data):
   - `/app/data` → `wrric-data`
   - `/app/logs` → `wrric-logs`

6. Click **Deploy**

### Method B: Manual Docker Deployment

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Clone the repository
git clone https://github.com/wrric-wrric/wrric.git
cd wrric/backend

# Create .env file
nano .env
# Paste your environment variables

# Build and run with Docker
docker build -t wrric-backend .
docker run -d --name wrric-backend \
  --restart unless-stopped \
  -p 8000:8000 \
  --env-file .env \
  wrric-backend
```

---

## Step 4: Deploy Frontend (Next.js)

### Build the Frontend Dockerfile

Create a `Dockerfile` in the `frontend/` directory:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Update next.config.ts for standalone output

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // ... your existing config
};

export default nextConfig;
```

### Deploy in Coolify

1. In Coolify:
   - Go to your project → **Add New Resource** → **Application**
   
2. Configure:
   - Name: `wrric-frontend`
   - Git Repository: `https://github.com/wrric-wrric/wrric.git`
   - Branch: `main`
   - Build Pack: `Nixpacks` (or Dockerfile if you created one)
   - Build Command: `npm run build`
   - Start Command: `npm start`

3. **Port**: Set to `3000`

4. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://api.your-domain.com
   NEXT_PUBLIC_WS_URL=wss://api.your-domain.com
   ```

5. **Domain**: Add your domain (e.g., `your-domain.com`)

6. Click **Deploy**

---

## Step 5: Configure Nginx Reverse Proxy (Optional)

If you're not using Coolify's built-in routing, set up Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.your-domain.com;

    # Backend
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Step 6: Run Database Migrations

After deploying the backend, run migrations:

```bash
# SSH into your backend container
docker exec -it wrric-backend bash

# Run migrations
alembic upgrade head

# Or use the init script
python init_db_simple.py
```

---

## Step 7: Verify Deployment

1. **Backend Health Check**:
   ```
   https://api.your-domain.com/api/health
   ```

2. **Frontend**:
   ```
   https://your-domain.com
   ```

3. **API Documentation**:
   ```
   https://api.your-domain.com/docs
   ```

---

## Step 8: Set Up SSL/TLS

Coolify automatically handles SSL via Let's Encrypt:

1. In Coolify, go to your resource → **Domains**
2. Add your domain (e.g., `your-domain.com`)
3. Enable **HTTPS** (Let's Encrypt)
4. Repeat for `api.your-domain.com`

---

## Recommended Coolify Resource Configuration

### Backend Resources
| Setting | Value |
|---------|-------|
| RAM | 4096 MB |
| CPU | 2 vCPU |
| Disk | 10 GB |
| Port | 8000 |

### Frontend Resources
| Setting | Value |
|---------|-------|
| RAM | 1024 MB |
| CPU | 1 vCPU |
| Disk | 5 GB |
| Port | 3000 |

### PostgreSQL Resources
| Setting | Value |
|---------|-------|
| RAM | 2048 MB |
| CPU | 1 vCPU |
| Disk | 20 GB |

---

## Troubleshooting

### Common Issues

1. **Database Connection Error**:
   - Verify `DATABASE_URL` is correct
   - Check PostgreSQL is running
   - Ensure database exists

2. **OAuth Login Not Working**:
   - Verify redirect URIs in Google/LinkedIn developer consoles
   - Check client IDs and secrets

3. **WebSocket Connection Failed**:
   - Ensure `NEXT_PUBLIC_WS_URL` is set correctly
   - Check firewall allows WebSocket connections

4. **Static Files Not Loading**:
   - Check volume mounts are correct
   - Verify file permissions

### Useful Commands

```bash
# View backend logs
docker logs wrric-backend

# View frontend logs  
docker logs wrric-frontend

# Restart services
docker restart wrric-backend
docker restart wrric-frontend

# Check running containers
docker ps
```

---

## Production Checklist

- [ ] Set strong passwords for all accounts
- [ ] Enable SSL/TLS
- [ ] Configure backups for PostgreSQL
- [ ] Set up monitoring and alerts
- [ ] Configure firewall rules
- [ ] Update JWT_SECRET_KEY to a secure random string
- [ ] Set proper CORS origins in backend
- [ ] Configure email SMTP for production

---

## Support

For issues or questions, refer to:
- Backend README: `backend/README.md`
- Frontend README: `frontend/README.md`
- Coolify Documentation: https://coolify.io/docs
