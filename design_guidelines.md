# ModernFeed RSS Reader - Design Guidelines

## Design Approach

**Selected Approach:** Design System with Productivity Focus (Linear + Feedly hybrid)

Drawing inspiration from Linear's clean efficiency and Feedly's content-first approach, this design prioritizes rapid content consumption, clear information hierarchy, and distraction-free reading.

**Core Principles:**
- Information density with breathing room
- Scan-optimized layouts for quick article browsing
- Clear visual separation between navigation, feed list, and reading pane
- Minimal chrome, maximum content

---

## Typography System

**Font Stack:**
- Primary: Inter (400, 500, 600) via Google Fonts
- Reading: Georgia or Merriweather (400, 700) for article content

**Hierarchy:**
- App headers: text-base font-medium
- Article titles in feed: text-lg font-semibold
- Article preview text: text-sm
- Reading view titles: text-3xl md:text-4xl font-bold
- Body text (reading): text-base md:text-lg leading-relaxed
- Metadata (dates, sources): text-xs text-gray-500
- Navigation items: text-sm font-medium

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 or p-6
- Section gaps: gap-4 or gap-6
- List item spacing: space-y-2 or space-y-4
- Container margins: m-8

**Application Structure:**

**Three-Column Layout (Desktop):**
1. **Left Sidebar** (w-64): Feed categories and sources
2. **Middle Panel** (flex-1 max-w-2xl): Article list/cards
3. **Right Reading Pane** (flex-1): Article content or empty state

**Responsive Behavior:**
- Mobile: Single column with bottom navigation
- Tablet: Two columns (sidebar + articles OR articles + reading)
- Desktop: Full three-column experience

---

## Component Library

### Navigation & Organization

**Left Sidebar:**
- Fixed positioning with vertical scroll
- Categories as collapsible sections
- Feed list items with unread count badges
- "Add Feed" button prominently placed at top
- Icon + text label format using Lucide icons

**Top Bar:**
- Search input (w-full max-w-md)
- View toggle buttons (card/list/compact)
- Refresh all feeds button
- Settings/profile menu

### Article Display

**Card View (Default):**
- Cards with subtle border, rounded corners (rounded-lg)
- Featured image at top (aspect-video or 16:9)
- Title, source, timestamp, read/unread indicator
- Excerpt preview (2-3 lines, line-clamp-3)
- Hover state: subtle shadow elevation

**List View (Compact):**
- Single row layout
- Small thumbnail (w-16 h-16)
- Title, source inline
- Read/unread status dot
- Tighter spacing (py-2)

**Article Metadata Bar:**
- Source favicon + name
- Publication time (relative: "2h ago")
- Reading time estimate
- Category tag
- Actions: star, mark read, share

### Reading Pane

**Article View:**
- Max width for readability (max-w-prose mx-auto)
- Generous line-height (leading-relaxed)
- Large title with source attribution below
- Hero image (if available) with proper aspect ratio
- Content with proper paragraph spacing (space-y-4)
- Bottom actions: original link, share, mark unread

### Forms & Inputs

**Add Feed Modal:**
- Centered modal (max-w-lg)
- URL input with validation feedback
- Category selector dropdown
- Auto-detect feed button
- Success/error states with clear messaging

**Search:**
- Persistent search bar in top navigation
- Real-time filtering as user types
- Keyboard navigation support (↑↓ for results)

### Interactive Elements

**Buttons:**
- Primary: Medium size (px-4 py-2), rounded-md
- Secondary: Ghost/outline variants
- Icon buttons: Square (w-8 h-8), centered icons

**Badges:**
- Unread counts: Circular, small (h-5 min-w-5)
- Category tags: Rounded-full, px-3 py-1, text-xs

---

## Key Screens & Flows

**Dashboard View:**
- Three-column layout active
- "All Items" selected by default
- Articles sorted chronologically (newest first)
- Infinite scroll for article list

**Empty States:**
- Large centered content with illustration placeholder
- "Add your first feed" CTA
- Quick links to popular feeds

**Settings Panel:**
- Slide-out panel from right
- Feed refresh interval selector
- Article retention settings
- Import/export OPML

---

## Images

**Hero/Welcome Screen:**
- Full-width hero section (h-96) for first-time users
- Illustration of RSS feed concept or content curation
- "Get Started" CTA overlaying with backdrop-blur-sm background

**Article Cards:**
- Featured images: aspect-video, object-cover
- Fallback: Source favicon on neutral background

**Empty States:**
- Centered illustrations (max-w-sm)
- Friendly, minimalist style

---

## Animations

Use sparingly:
- Skeleton loading states for feed fetching
- Smooth transitions for read/unread state (opacity change)
- Slide-in for reading pane on article selection
- No scroll animations or complex effects

---

This design creates a fast, focused reading experience that respects user attention while providing powerful organization and discovery features. The layout adapts seamlessly across devices while maintaining clarity and usability.