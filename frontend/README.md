# WRRIC - Climate Tech Research Platform

<div align="center">

**Accelerating Climate Innovation in Sub-Saharan Africa**

[![Next.js](https://img.shields.io/badge/Next.js-15.3.5-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb?style=flat-square&logo=react)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Private-red?style=flat-square)](LICENSE)

</div>

---

## 📋 Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
- [Development](#development)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Key Features Deep Dive](#key-features-deep-dive)
- [API Integration](#api-integration)
- [Contributing](#contributing)
- [License](#license)

---

## 🌍 About

**WRRIC** is a comprehensive climate tech research and collaboration platform designed specifically for Sub-Saharan Africa. It connects researchers, laboratories, innovators, and funding partners to accelerate climate action through technology and collaboration.

The platform serves as a centralized hub for:
- 🔬 **Research Discovery** - Find and explore climate tech laboratories and research institutions
- 🤝 **Collaboration** - Connect researchers, partners, and funders
- 📊 **Data Visualization** - Interactive maps and analytics for climate research
- 🎯 **Event Management** - Hackathons, conferences, and networking events
- 💡 **Innovation Tracking** - Monitor climate tech developments across the region

---

## ✨ Features

### Core Functionality

#### 🔍 **Advanced Search & Discovery**
- Real-time WebSocket-powered search
- Filter by country, sector, and research focus
- reCAPTCHA-protected search to prevent abuse
- Search history and session management

#### 🗺️ **Interactive Mapping**
- D3.js-powered geographic visualization
- Africa-focused heatmaps for research density
- Lab and partner location tracking
- Country and region-based filtering

#### 🔬 **Laboratory Profiles**
- Comprehensive lab information including:
  - Research abstracts and focus areas
  - Equipment and capabilities
  - Publications and Google Scholar integration
  - EduRank scoring and metrics
  - Contact information and inquiry system
- Social engagement (likes, comments, shares, follows)
- Image galleries with fallback support
- Bookmark and follow functionality

#### 👥 **User & Profile Management**
- Multi-profile support (researchers, organizations, etc.)
- Profile switching and management
- Authentication via Email, Google, LinkedIn
- Role-based access control (Admin, Judge, User)
- Password reset and account setup flows

#### 🎪 **Event Management**
- Create and manage climate tech events
- Registration system with approval workflows
- Event discovery and filtering
- Email notifications and reminders
- Attendee import and management

#### 🤝 **Partner Ecosystem**
- Partner directory and discovery
- Partner profile management
- Lab-to-partner connections
- Verification and featured partner badges

#### 💰 **Funder Matching**
- Funder profiles and proposal systems
- Match recommendations
- Proposal submission and tracking
- Funding opportunity discovery

#### 🏆 **Hackathon & Judging**
- Hackathon creation and management
- Participant registration
- Multi-category judging system
- Real-time leaderboards
- Email notifications for judges and participants

#### 📱 **Social Features**
- Activity feed with likes, comments, shares
- Real-time notifications
- Direct messaging system
- Following/follower system
- Bookmarking

#### 🎨 **UI/UX Excellence**
- Dark/Light theme support
- Responsive design (mobile-first)
- Smooth animations with Motion
- Toast notifications
- Global banner system with dismissal
- Loading states and skeletons

---

## 🛠️ Tech Stack

### Frontend Framework
- **Next.js 15.3.5** - React framework with App Router
- **React 18.2** - UI library
- **TypeScript 5** - Type safety and developer experience

### Styling & UI
- **TailwindCSS 3.4** - Utility-first CSS framework
- **Radix UI** - Headless UI components (Dialog, Tooltip, Separator)
- **Lucide React** - Icon library
- **next-themes** - Theme management
- **tailwindcss-animate** - Animation utilities
- **class-variance-authority** - Component variant management

### Data Visualization
- **D3.js 7.9** - Data visualization and mapping
- **d3-geo** - Geographic projections
- **TopoJSON** - Topological geospatial data

### Forms & Interaction
- **react-hot-toast** - Toast notifications
- **emoji-picker-react** - Emoji selector
- **qrcode** - QR code generation

### Utilities
- **date-fns** - Date manipulation
- **clsx** - Conditional classnames
- **tailwind-merge** - Merge Tailwind classes

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Turbopack** - Fast development bundler

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.0 or higher
- **npm**, **yarn**, **pnpm**, or **bun** package manager
- Backend API server (configured via environment variables)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wrric-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory (see [Environment Variables](#environment-variables) section)

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🔐 Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Backend API Configuration
NEXT_PUBLIC_BACKEND_URL=https://api.example.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://api.example.com

# reCAPTCHA Configuration
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
NEXT_PUBLIC_SITE_KEY=your_site_key_here

# Email Configuration (Resend)
NEXT_PUBLIC_RESEND_API_KEY=your_resend_api_key_here
NEXT_PUBLIC_FEEDBACK_RECEIVER=admin@example.com
```

### Environment Variable Descriptions

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_BACKEND_URL` | Base URL for the backend API | ✅ Yes |
| `NEXT_PUBLIC_WEBSOCKET_URL` | WebSocket server URL for real-time features | ✅ Yes |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Google reCAPTCHA v2 site key | ✅ Yes |
| `NEXT_PUBLIC_SITE_KEY` | Alternative site key for certain features | ⚠️ Optional |
| `NEXT_PUBLIC_RESEND_API_KEY` | Resend API key for email notifications | ⚠️ Optional |
| `NEXT_PUBLIC_FEEDBACK_RECEIVER` | Email address for user feedback | ⚠️ Optional |

---

## 💻 Development

### Available Scripts

```bash
# Start development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint
```

### Development Workflow

1. **Hot Reload** - Changes to files automatically refresh the browser
2. **TypeScript** - Full type checking during development
3. **Turbopack** - Fast bundling with `--turbo` flag
4. **ESLint** - Run linting before committing changes

### Code Quality

- **Linting**: ESLint configured with Next.js recommended rules
- **Type Safety**: Strict TypeScript configuration
- **Code Style**: Consistent formatting with Prettier (if configured)

---

## 🏗️ Building for Production

### Build Process

```bash
# Create optimized production build
npm run build
```

This will:
1. ✅ Run ESLint checks
2. ✅ Compile TypeScript
3. ✅ Generate static pages (139 pages)
4. ✅ Optimize images and assets
5. ✅ Create production bundles

### Build Output

```
Route (app)                                                  Size       First Load JS
┌ ○ /                                                        7.74 kB        114 kB
├ ○ /admin                                                   2.81 kB        105 kB
├ ○ /labs                                                    13.2 kB        162 kB
├ ○ /map                                                     29.3 kB        143 kB
└ ... (139 routes total)

○  (Static)   - Prerendered as static content
ƒ  (Dynamic)  - Server-rendered on demand
```

### Deployment

```bash
# Start production server locally
npm run start
```

**Recommended Platforms:**
- [Vercel](https://vercel.com) - Optimized for Next.js
- [Netlify](https://netlify.com)
- [AWS Amplify](https://aws.amazon.com/amplify/)
- [Docker](https://www.docker.com/) - Custom hosting

---

## 📁 Project Structure

```
wrric-frontend/
├── app/                          # Next.js App Router
│   ├── admin/                    # Admin panel routes
│   │   ├── events/              # Event management
│   │   ├── hackathons/          # Hackathon management
│   │   ├── users/               # User management
│   │   └── partners/            # Partner management
│   ├── auth/                     # Authentication flows
│   │   ├── login/
│   │   ├── register/
│   │   ├── callback/            # OAuth callbacks
│   │   └── complete-registration/
│   ├── events/                   # Public events
│   ├── labs/                     # Laboratory discovery
│   ├── partners/                 # Partner directory
│   ├── funders/                  # Funder matching
│   ├── profiles/                 # User profiles
│   ├── map/                      # Interactive map
│   ├── search/                   # Search interface
│   ├── feed/                     # Social feed
│   ├── api/                      # API routes
│   └── [...other routes]/
├── components/                   # React components
│   ├── Lab/                      # Lab-related components
│   ├── auxiliaries/             # Helper components
│   ├── admin/                    # Admin components
│   └── ui/                       # Reusable UI components
├── hooks/                        # Custom React hooks
├── lib/                          # Utilities and helpers
│   └── types/                    # TypeScript type definitions
├── types/                        # Additional type definitions
├── utils/                        # Utility functions
├── public/                       # Static assets
├── docs/                         # Documentation
├── global.d.ts                   # Global TypeScript declarations
├── tailwind.config.ts           # Tailwind configuration
├── next.config.ts               # Next.js configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies and scripts
```

---

## 🎯 Key Features Deep Dive

### Real-time Search with WebSocket

The platform uses WebSocket connections for real-time search functionality:

```typescript
// Search is protected by reCAPTCHA
// Results stream in real-time via WebSocket
// Supports multiple search types: general, publications, websites
```

**Features:**
- Session-based search tracking
- Query history
- reCAPTCHA validation
- Real-time result streaming

### Interactive D3 Map

Africa-focused geographic visualization:

```typescript
// Uses D3.js for mercator projection
// TopoJSON for efficient data transfer
// Heatmap visualization for research density
// Click to view lab details
```

### Global Banner System

Persistent notifications with smart dismissal:

```typescript
// Frequency-based display (first_visit, always, once)
// User-specific dismissal tracking
// Route-based visibility control
// Admin path exclusion
```

### Multi-Profile System

Users can have multiple profiles for different contexts:

- **Personal Profile** - Individual researcher
- **Organization Profile** - Institution or company
- **Lab Profile** - Research laboratory

---

## 🔌 API Integration

### Backend Communication

The frontend communicates with the backend via:

1. **REST API** - Standard HTTP requests
2. **WebSocket** - Real-time features (search, notifications)
3. **OAuth** - Third-party authentication

### API Routes

Internal Next.js API routes handle:
- `/api/feedback` - User feedback submission
- Additional routes for server-side processing

### Authentication Flow

```
User Login → OAuth/Email → Backend Token → localStorage
→ Protected Routes → Auto-refresh on token expiry
```

---

## 🤝 Contributing

### Development Guidelines

1. **Branch Naming**
   - `feature/description` - New features
   - `bugfix/description` - Bug fixes
   - `hotfix/description` - Urgent fixes

2. **Commit Messages**
   - Use conventional commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`
   - Be descriptive and concise

3. **Code Style**
   - Run `npm run lint` before committing
   - Follow TypeScript best practices
   - Use functional components with hooks

4. **Testing**
   - Ensure builds pass: `npm run build`
   - Test in both light and dark themes
   - Check mobile responsiveness

### Pull Request Process

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request with a clear description

---

## 📄 License

This project is private and proprietary. All rights reserved.

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons by [Lucide](https://lucide.dev/)
- Maps powered by [D3.js](https://d3js.org/)
- Styling with [TailwindCSS](https://tailwindcss.com/)

---

## 📞 Support

For support, please contact the development team or create an issue in the repository.

---

<div align="center">

**Made with ❤️ for Climate Action in Africa**

</div>
