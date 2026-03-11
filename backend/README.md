# Unlokinno Intelligence Platform - Backend

<div align="center">

![FastAPI](https://img.shields.io/badge/FastAPI-0.115.12-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-Enabled-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

**A comprehensive climate tech research intelligence and hackathon management platform**

[Features](#-features) • [Quick Start](#-quick-start) • [API Docs](#-api-documentation) • [Architecture](#-architecture) • [Deployment](#-deployment)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [Database Models](#-database-models)
- [WebSocket API](#-websocket-api)
- [Services](#-services)
- [Authentication](#-authentication)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

The Unlokinno Intelligence Platform is a **B2B ecosystem platform** connecting climate tech researchers, labs, entrepreneurs, funders, and judges. It provides:

- **Research Intelligence** - AI-powered lab discovery and matchmaking
- **Hackathon Management** - Complete hackathon lifecycle with judge scoring
- **Partner Ecosystem** - Organization management with entity assignments
- **Social Platform** - Follow, like, comment, and share on labs
- **Real-time Messaging** - WebSocket-powered direct messaging

---

## 🌟 Features

### 🔬 Research & Lab Discovery
| Feature | Description |
|---------|-------------|
| **Real-Time Scraping** | WebSocket streaming with live progress updates |
| **LLM Extraction** | Groq API with Gemini fallback for intelligent data extraction |
| **Semantic Search** | Sentence-transformers embeddings for similarity matching |
| **Entity Management** | Labs, startups, and organizations with rich metadata |
| **Publication Tracking** | Academic publications linked to entities |

### 🏆 Hackathon Management
| Feature | Description |
|---------|-------------|
| **Multi-Judge Scoring** | Customizable scoring schemas with weights and rubrics |
| **Participant Management** | Bulk CSV import with duplicate detection |
| **Category System** | Organize participants and judges by categories |
| **Leaderboard Control** | Three phases: Hidden → Locked → Public |
| **Email Notifications** | Automated emails to judges and participants |
| **Judge Portal** | Dedicated interface for judges to submit scores |

### 👥 User & Profile System
| Feature | Description |
|---------|-------------|
| **Multiple Profiles** | Users can have Lab, Entrepreneur, Academic, Funder profiles |
| **Profile Backlinks** | Ecosystem connections (collaboration, mentorship, funding) |
| **Entity Linking** | Connect profiles to labs and organizations |
| **Follow System** | Follow users, partners, and labs |

### 🤝 Partner Management
| Feature | Description |
|---------|-------------|
| **Organization Profiles** | Partner organizations with approval workflow |
| **Member Roles** | Viewer, Editor, Admin access levels |
| **Entity Assignment** | Assign labs/entities to partner organizations |
| **Invitation System** | Token-based invitations with expiry |

### 💬 Messaging & Notifications
| Feature | Description |
|---------|-------------|
| **Real-Time Messaging** | WebSocket-powered instant messaging |
| **File Attachments** | B2 cloud storage for media |
| **Read Receipts** | Delivery and read status tracking |
| **Push Notifications** | In-app and email notifications |
| **Notification Preferences** | Per-user notification settings |

### 📅 Event Management
| Feature | Description |
|---------|-------------|
| **Event Types** | Hackathons, conferences, workshops |
| **Registration** | Profile-first with guest checkout option |
| **Ticket Types** | Multiple ticket types and attendance modes |
| **CSV Import** | Bulk attendee import |
| **Email Campaigns** | Send emails to participants with attachments |

### 🔒 Authentication & Security
| Feature | Description |
|---------|-------------|
| **JWT Authentication** | Secure token-based auth with HS256 |
| **OAuth 2.0** | Google and LinkedIn social login |
| **Password Reset** | Token-based password recovery |
| **Admin Verification** | Role-based access control |
| **Rate Limiting** | API rate limiting and spam detection |

### 💼 Funding Ecosystem
| Feature | Description |
|---------|-------------|
| **Funder Profiles** | VC, Angel, Government, Foundation types |
| **Proposals** | Funding proposals with ask amounts |
| **Matchmaking** | AI-powered funder-startup matching |
| **Match Records** | Track matching scores and interactions |

### 🌐 Social Features
| Feature | Description |
|---------|-------------|
| **Likes** | Like labs and entities |
| **Comments** | Threaded comments with soft deletes |
| **Shares** | Track social sharing (link, platforms) |
| **Activity Feed** | Personalized activity stream |
| **Bookmarks** | Save and organize entities |

---

## 🛠 Tech Stack

### Core Framework
- **FastAPI** 0.115.12 - Modern async Python web framework
- **Uvicorn** 0.34.2 - ASGI server with hot reload
- **Pydantic** 2.11 - Data validation and serialization

### Database
- **PostgreSQL** 15+ - Primary database
- **SQLAlchemy** 2.0 - Async ORM with connection pooling
- **Alembic** 1.16 - Database migrations
- **asyncpg** - Async PostgreSQL driver

### Authentication
- **python-jose** - JWT token handling
- **bcrypt** - Password hashing
- **OAuth 2.0** - Google & LinkedIn integration

### AI/ML
- **Groq API** - LLM-powered extraction
- **Google Generative AI** - Gemini fallback
- **Sentence Transformers** 4.1 - Semantic embeddings
- **spaCy** 3.8 - NLP processing

### Real-Time
- **WebSockets** - Native FastAPI WebSocket support
- **APScheduler** - Background job scheduling

### Storage
- **Backblaze B2** - Cloud file storage (boto3)
- **PIL/Pillow** - Image processing

### Data Processing
- **Pandas** 2.3 - Data manipulation
- **pdfplumber** - PDF extraction
- **BeautifulSoup4** - HTML parsing
- **httpx** - Async HTTP client

---

## 📁 Project Structure

```
backend_lastest/
├── api/                          # API routes and endpoints
│   ├── routes.py                 # Main router aggregator
│   ├── auth.py                   # OAuth (Google/LinkedIn)
│   ├── dependencies.py           # Auth dependencies & utilities
│   ├── schemas.py                # Core Pydantic schemas
│   ├── profiles.py               # User profile endpoints
│   ├── messages.py               # Messaging endpoints
│   ├── events.py                 # Public event endpoints
│   ├── judge.py                  # Judge portal API
│   ├── partners.py               # Partner management
│   ├── funders.py                # Funder endpoints
│   ├── proposals.py              # Funding proposals
│   ├── notifications.py          # Notification system
│   ├── labs_social.py            # Like/share endpoints
│   ├── comments.py               # Comment system
│   ├── follows.py                # Follow relationships
│   ├── feed.py                   # Activity feed
│   ├── bookmarks.py              # Bookmark system
│   ├── search.py                 # Search endpoints
│   ├── blocks.py                 # User blocking
│   ├── user_entity_api.py        # Entity management
│   ├── match_records.py          # Matching records
│   └── admin/                    # Admin-only endpoints
│       ├── events.py             # Event management
│       ├── hackathons.py         # Hackathon management
│       ├── users.py              # User administration
│       ├── entities.py           # Entity administration
│       ├── categories.py         # Category management
│       ├── analytics.py          # Analytics endpoints
│       ├── upload.py             # File upload handling
│       └── partners.py           # Partner administration
│
├── models/                       # Database models
│   └── db_models.py              # All SQLAlchemy models
│
├── schemas/                      # Pydantic schemas
│   ├── events.py                 # Event schemas
│   ├── hackathon.py              # Hackathon schemas
│   ├── partner.py                # Partner schemas
│   └── profiles.py               # Profile schemas
│
├── services/                     # Business logic layer
│   ├── event_service.py          # Event operations
│   ├── hackathon_scoring_service.py    # Scoring logic
│   ├── hackathon_upload_service.py     # CSV import
│   ├── hackathon_email_service.py      # Email notifications
│   ├── message_service.py        # Messaging logic
│   ├── partner_service.py        # Partner operations
│   ├── notification_service.py   # Notifications
│   ├── comment_service.py        # Comments
│   ├── like_service.py           # Likes
│   ├── share_service.py          # Shares
│   ├── follow_service.py         # Follows
│   ├── bookmark_service.py       # Bookmarks
│   ├── activity_service.py       # Activity logging
│   ├── search_service.py         # Search operations
│   ├── analytics_service.py      # Analytics
│   ├── view_service.py           # View tracking
│   ├── block_service.py          # Blocking
│   └── social_notification_service.py  # Social notifications
│
├── websockets/                   # WebSocket handlers
│   ├── manager.py                # Connection management
│   ├── handlers/                 # Main WebSocket logic
│   │   ├── websocket_handler.py  # Core handler
│   │   ├── query_handler.py      # Query processing
│   │   └── error_handler.py      # Error handling
│   └── messages/                 # Messaging WebSocket
│       ├── connection_manager.py # Message connections
│       └── message_handler.py    # Message handling
│
├── utils/                        # Utilities
│   ├── database.py               # DB connection & sessions
│   ├── password_reset.py         # Password reset tokens
│   ├── rate_limiter.py           # Rate limiting
│   └── spam_filter.py            # Spam detection
│
├── algorithms/                   # Matching algorithms
│   └── matchmaking.py            # Funder-startup matching
│
├── alembic/                      # Database migrations
│   ├── versions/                 # Migration files
│   └── env.py                    # Alembic configuration
│
├── main.py                       # Application entry point
├── requirements.txt              # Python dependencies
├── Dockerfile                    # Docker configuration
├── docker-compose.yml            # Docker Compose setup
└── gunicorn_config.py            # Production server config
```

---

## 🚀 Quick Start

### Prerequisites

- **Python** ≥ 3.10
- **PostgreSQL** ≥ 15
- **Redis** (optional, for caching)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/unlokinno/unlokinno-intelligence.git
   cd unlokinno-intelligence/backend_lastest
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   
   # Windows
   .\venv\Scripts\activate
   
   # Linux/macOS
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

5. **Run database migrations**
   ```bash
   alembic upgrade head
   ```

6. **Start the server**
   ```bash
   # Development
   python main.py
   
   # Or with uvicorn directly
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

7. **Access the API**
   - API Base URL: `http://localhost:8000/api`
   - Interactive Docs: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

### Docker Setup

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f backend
```

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```bash
# ═══════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/unlokinno
# For sync operations (Alembic)
SYNC_DATABASE_URL=postgresql://user:password@localhost:5432/unlokinno

# ═══════════════════════════════════════════════════════════════
# AUTHENTICATION
# ═══════════════════════════════════════════════════════════════
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# ═══════════════════════════════════════════════════════════════
# OAUTH - GOOGLE
# ═══════════════════════════════════════════════════════════════
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# ═══════════════════════════════════════════════════════════════
# OAUTH - LINKEDIN
# ═══════════════════════════════════════════════════════════════
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:8000/api/auth/linkedin/callback

# ═══════════════════════════════════════════════════════════════
# EMAIL (SMTP)
# ═══════════════════════════════════════════════════════════════
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM_NAME=Unlokinno Platform
EMAIL_FROM_ADDRESS=noreply@unlokinno.com

# ═══════════════════════════════════════════════════════════════
# RECAPTCHA
# ═══════════════════════════════════════════════════════════════
RECAPTCHA_KEY=your-recaptcha-site-key
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key

# ═══════════════════════════════════════════════════════════════
# AI/LLM APIs
# ═══════════════════════════════════════════════════════════════
GROQ_API_KEY=your-groq-api-key
GOOGLE_API_KEY=your-gemini-api-key

# ═══════════════════════════════════════════════════════════════
# CLOUD STORAGE (BACKBLAZE B2)
# ═══════════════════════════════════════════════════════════════
B2_KEY_ID=your-b2-key-id
B2_APPLICATION_KEY=your-b2-application-key
B2_BUCKET_NAME=your-bucket-name
B2_BUCKET_ID=your-bucket-id

# ═══════════════════════════════════════════════════════════════
# FRONTEND
# ═══════════════════════════════════════════════════════════════
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# ═══════════════════════════════════════════════════════════════
# OPTIONAL
# ═══════════════════════════════════════════════════════════════
DEBUG=true
LOG_LEVEL=DEBUG
```

---

## 📚 API Documentation

### Base URL
```
http://localhost:8000/api
```

### Authentication Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/login` | Email/password login | No |
| `POST` | `/signup` | Create new account | No |
| `GET` | `/verify-token` | Validate JWT token | Yes |
| `POST` | `/forgot-password` | Request password reset | No |
| `POST` | `/reset-password` | Reset password with token | No |
| `GET` | `/reset-password/validate` | Validate reset token | No |

### OAuth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/auth/providers` | List available OAuth providers |
| `GET` | `/auth/google/login` | Initiate Google OAuth |
| `GET` | `/auth/google/callback` | Google OAuth callback |
| `GET` | `/auth/linkedin/login` | Initiate LinkedIn OAuth |
| `GET` | `/auth/linkedin/callback` | LinkedIn OAuth callback |
| `POST` | `/auth/oauth/set-password` | Set password for OAuth user |

### Profile Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/profiles` | List user's profiles | Yes |
| `POST` | `/profiles` | Create new profile | Yes |
| `GET` | `/profiles/{id}` | Get profile by ID | No |
| `PATCH` | `/profiles/{id}` | Update profile | Yes |
| `DELETE` | `/profiles/{id}` | Delete profile | Yes |

### Hackathon Management (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/admin/hackathons` | Create hackathon |
| `GET` | `/admin/hackathons` | List hackathons |
| `GET` | `/admin/hackathons/{id}` | Get hackathon details |
| `PUT` | `/admin/hackathons/{id}` | Update hackathon |
| `POST` | `/admin/hackathons/{id}/participants/upload` | Upload participants CSV |
| `POST` | `/admin/hackathons/{id}/judges/upload` | Upload judges CSV |
| `GET` | `/admin/hackathons/{id}/participants` | List participants |
| `GET` | `/admin/hackathons/{id}/judges` | List judges |
| `POST` | `/admin/hackathons/{id}/scoring-schema` | Create scoring schema |
| `GET` | `/admin/hackathons/{id}/leaderboard` | Get leaderboard |
| `PATCH` | `/admin/hackathons/{id}/leaderboard-phase` | Update leaderboard visibility |
| `POST` | `/admin/hackathons/{id}/send-emails` | Send bulk emails |

### Judge Portal Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/judge/hackathons` | List assigned hackathons | Yes |
| `GET` | `/judge/hackathons/{id}` | Get hackathon for judging | Yes |
| `GET` | `/judge/hackathons/{id}/participants` | Get participants to score | Yes |
| `POST` | `/judge/hackathons/{id}/scores` | Submit scores | Yes |
| `GET` | `/judge/hackathons/{id}/leaderboard` | View leaderboard | Yes |
| `GET` | `/judge/hackathons/{id}/progress` | Get judging progress | Yes |

### Partner Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/partners` | List partners | No |
| `POST` | `/partners` | Create partner | Yes |
| `GET` | `/partners/{id}` | Get partner details | No |
| `PATCH` | `/partners/{id}` | Update partner | Yes |
| `POST` | `/partners/{id}/members` | Add member | Yes |
| `POST` | `/partners/{id}/labs/{entity_id}` | Assign entity to partner | Yes |
| `DELETE` | `/partners/{id}/labs/{entity_id}` | Remove entity from partner | Yes |

### Messaging Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/messages/conversations` | List conversations | Yes |
| `GET` | `/messages/conversations/{id}` | Get conversation messages | Yes |
| `POST` | `/messages/send` | Send message | Yes |
| `PATCH` | `/messages/{id}/read` | Mark as read | Yes |

### Social Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/labs/{id}/like` | Like a lab | Yes |
| `DELETE` | `/labs/{id}/like` | Unlike a lab | Yes |
| `POST` | `/comments` | Add comment | Yes |
| `GET` | `/comments/entity/{id}` | Get entity comments | No |
| `POST` | `/follow/{type}/{id}` | Follow user/partner/lab | Yes |
| `DELETE` | `/follow/{type}/{id}` | Unfollow | Yes |
| `GET` | `/feed` | Get activity feed | Yes |
| `POST` | `/bookmarks` | Add bookmark | Yes |
| `GET` | `/bookmarks` | List bookmarks | Yes |

### Full Documentation

For complete API documentation with request/response schemas:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

## 🗄 Database Models

### Core Models

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│ User                    │ Profile                │ ProfileBacklink│
│ - id (UUID)             │ - id (UUID)            │ - source_id    │
│ - email                 │ - user_id (FK)         │ - target_id    │
│ - username              │ - type                 │ - type         │
│ - password_hash         │ - display_name         │ - status       │
│ - is_admin              │ - bio, title, org      │                │
│ - suspended             │ - expertise[]          │                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       ENTITY SYSTEM                              │
├─────────────────────────────────────────────────────────────────┤
│ Entity                  │ EntityImage            │ Publication    │
│ - id (INT)              │ - entity_id (FK)       │ - entity_id    │
│ - university            │ - image_url            │ - title        │
│ - research_abstract     │ - is_primary           │ - authors      │
│ - embedding (VECTOR)    │                        │ - doi          │
│ - climate_focus         │                        │                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      HACKATHON SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│ Event                   │ HackathonConfig        │ ScoringSchema  │
│ - id (UUID)             │ - event_id (FK)        │ - hackathon_id │
│ - title, slug           │ - leaderboard_phase    │ - name         │
│ - event_datetime        │ - judging_start/end    │ - max_score    │
│ - location_type         │                        │ - weight       │
├─────────────────────────┼────────────────────────┼────────────────┤
│ HackathonParticipant    │ HackathonJudge         │ ParticipantScore│
│ - hackathon_id          │ - hackathon_id         │ - participant_id│
│ - email, full_names     │ - user_id              │ - judge_id     │
│ - theme, category       │ - category_id          │ - score_value  │
│ - is_group              │                        │ - comment      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       PARTNER SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│ Partner                 │ PartnerMember          │ PartnerEntity  │
│ - id (UUID)             │ - partner_id           │ - partner_id   │
│ - name, slug            │ - user_id              │ - entity_id    │
│ - status                │ - role                 │ - assigned_by  │
│ - geolocation           │ - joined_at            │                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      MESSAGING SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│ Message                 │ MessageAttachment      │ Notification   │
│ - id (UUID)             │ - message_id           │ - user_id      │
│ - sender_profile_id     │ - file_url             │ - type         │
│ - receiver_profile_id   │ - file_type            │ - data (JSON)  │
│ - content               │ - file_size            │ - read         │
│ - read_at               │                        │                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔌 WebSocket API

### Research Intelligence WebSocket

**Endpoint**: `ws://localhost:8000/ws`

```javascript
// Connect
const ws = new WebSocket('ws://localhost:8000/ws');

// Send query
ws.send(JSON.stringify({
  type: 'query',
  session_id: 'uuid',
  query: 'climate tech labs in California',
  token: 'jwt-token'  // optional
}));

// Receive updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type: 'progress', 'result', 'complete', 'error'
};
```

### Messaging WebSocket

**Endpoint**: `ws://localhost:8000/ws/messages`

```javascript
// Connect with auth
const ws = new WebSocket('ws://localhost:8000/ws/messages', {
  headers: { Authorization: 'Bearer jwt-token' }
});

// Send message
ws.send(JSON.stringify({
  type: 'message',
  receiver_profile_id: 'uuid',
  content: 'Hello!'
}));

// Receive messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type: 'message', 'read_receipt', 'typing'
};
```

---

## ⚙ Services

| Service | Description |
|---------|-------------|
| `EventService` | Event CRUD, registration, category management |
| `HackathonScoringService` | Score validation, leaderboard calculation |
| `HackathonUploadService` | CSV import for participants/judges |
| `HackathonEmailService` | Bulk email notifications |
| `MessageService` | Message delivery, encryption |
| `PartnerService` | Partner organization management |
| `NotificationService` | Push notifications |
| `CommentService` | Comment CRUD, threading |
| `LikeService` | Lab likes |
| `ShareService` | Share tracking |
| `FollowService` | Follow relationships |
| `BookmarkService` | Bookmarks & collections |
| `ActivityService` | Activity logging |
| `SearchService` | Full-text search |
| `AnalyticsService` | Usage analytics |

---

## 🔒 Authentication

### JWT Token Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Login   │────▶│  Server  │
│          │     │ Endpoint │     │          │
└──────────┘     └──────────┘     └──────────┘
     │                                  │
     │         JWT Token                │
     │◀─────────────────────────────────│
     │                                  │
     │    Authorization: Bearer <token> │
     │─────────────────────────────────▶│
     │                                  │
     │         Protected Data           │
     │◀─────────────────────────────────│
```

### Protected Route Example

```python
from api.dependencies import get_current_user, verify_admin

@router.get("/protected")
async def protected_route(
    current_user: str = Depends(get_current_user)
):
    return {"user_id": current_user}

@router.get("/admin-only")
async def admin_route(
    admin_user: str = Depends(verify_admin)
):
    return {"admin_id": admin_user}
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=api --cov-report=html

# Run specific test file
pytest tests/test_auth.py -v
```

### Manual API Testing

```bash
# Login
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","recaptchaResponse":"test"}'

# Get events (public)
curl http://localhost:8000/api/events/upcoming

# Protected endpoint
curl http://localhost:8000/api/profiles \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## 🚀 Deployment

### Production with Gunicorn

```bash
gunicorn main:app -c gunicorn_config.py
```

### Docker Production

```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "main:app", "-c", "gunicorn_config.py"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/unlokinno
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: unlokinno
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Production Checklist

- [ ] Set `DEBUG=false`
- [ ] Use strong `JWT_SECRET` (32+ chars)
- [ ] Configure production database URL
- [ ] Set up SSL/TLS
- [ ] Configure CORS for production domains
- [ ] Set up database backups
- [ ] Configure logging and monitoring
- [ ] Set up rate limiting
- [ ] Run security audit

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Database connection fails** | Verify `DATABASE_URL` and PostgreSQL is running |
| **JWT token invalid** | Check `JWT_SECRET` matches and token not expired |
| **OAuth callback fails** | Verify redirect URIs match exactly |
| **WebSocket disconnects** | Check CORS settings and proxy configuration |
| **Email not sending** | Verify SMTP credentials and app password |
| **File upload fails** | Check B2 credentials and bucket permissions |
| **Alembic migration fails** | Ensure `SYNC_DATABASE_URL` is set correctly |

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=DEBUG python main.py
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new functionality
4. Ensure all tests pass (`pytest`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

- Follow PEP 8 guidelines
- Use type hints
- Document functions with docstrings
- Keep functions focused and small

---

## 📄 License

This project is private

---

<div align="center">

**Built with ❤️ for Climate Tech Innovation**

[Report Bug](https://github.com/unlokinno/unlokinno-intelligence/issues) • [Request Feature](https://github.com/unlokinno/unlokinno-intelligence/issues)

</div>
