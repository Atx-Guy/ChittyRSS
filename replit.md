# ModernFeed RSS Reader

## Overview

ModernFeed is a modern RSS reader application inspired by Feedly and Linear's design principles. It allows users to aggregate, organize, and read articles from their favorite RSS feeds in a clean, distraction-free interface. The application features a three-column layout with feed navigation, article lists, and a reading pane.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled via Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state, caching, and optimistic updates
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens defined in CSS variables (supports light/dark themes)
- **Design System**: Productivity-focused layout with three-column desktop view (sidebar, article list, reading pane)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful endpoints under `/api/` prefix
- **Build Process**: esbuild for server bundling, Vite for client bundling
- **Development**: tsx for TypeScript execution, Vite dev server with HMR

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` - contains all database tables and Zod validation schemas
- **Database Tables**:
  - `categories` - Feed organization folders
  - `feeds` - RSS feed sources with metadata
  - `articles` - Individual articles from feeds
  - `users` - User accounts

### Key Design Patterns
- **Shared Types**: Schema definitions in `/shared` directory are shared between client and server
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared directory
- **Storage Interface**: Abstract storage layer in `server/storage.ts` for database operations
- **RSS Parsing**: Uses `rss-parser` library for fetching and parsing feed content

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Connection Pool**: pg library with connection pooling

### Third-Party Services
- **Google Favicons API**: Used to fetch website favicons (`https://www.google.com/s2/favicons`)

### Key NPM Packages
- `rss-parser` - RSS/Atom feed parsing
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `@tanstack/react-query` - Server state management
- `date-fns` - Date formatting utilities
- `zod` - Runtime type validation
- `express-session` / `connect-pg-simple` - Session management (configured for PostgreSQL storage)