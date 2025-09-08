# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a full-stack backlink checker application with two main components:

### Frontend (Next.js 14 with App Router)
- **Location**: Root directory
- **Main entry**: `app/page.tsx` - Contains the main page with `BacklinkInput` and `BacklinkResults` components
- **API route**: `app/api/check/route.ts` - Handles CSV/manual data processing and forwards jobs to backend
- **Components**: 
  - `components/backlink-input.tsx` - Handles CSV upload, manual input, and table-based input with spreadsheet-like functionality
  - `components/backlink-results.tsx` - Real-time results display with Socket.io integration, export functionality, and recrawl features
- **UI Framework**: Shadcn UI components (in `components/ui/`)
- **Real-time Communication**: Socket.io client connecting to backend server

### Backend (Express + Socket.io)
- **Location**: `server/` directory
- **Main file**: `server/index.js` - Express server with Socket.io for real-time communication
- **Job Processing**: In-memory job queue with backlink checking using Axios + Cheerio
- **Web Scraping**: Uses realistic browser headers and handles relative/absolute URL conversion
- **Features**: Job recrawling, progress updates, error handling with timeout detection

## Development Commands

Start both frontend and backend together:
```bash
npm run dev:all
```

Or start them separately:
```bash
# Backend server (runs on port 4000)
npm run server

# Frontend development server (runs on port 3000) 
npm run dev
```

Build and start production:
```bash
npm run build
npm start
```

Code quality:
```bash
npm run lint
```

## Key Data Flow

1. User submits backlink data via `BacklinkInput` component (CSV upload, manual input, or table)
2. Frontend processes data in `/api/check` route and creates job with UUIDs
3. Frontend forwards job to backend via HTTP POST to `/api/jobs`
4. Backend processes each backlink sequentially with 1-second delays
5. Real-time progress updates sent via Socket.io `progress` events
6. `BacklinkResults` component updates UI in real-time
7. Users can export results as CSV or recrawl failed/error items

## Job Status Flow

Jobs progress through these states:
- `pending` → `checking` → `found`/`not-found`/`error`/`timeout`

## Socket.io Events

- `join` - Client joins job room for updates
- `progress` - Server sends job progress updates
- `complete` - Job completion notification  
- `recrawl` - Client requests re-checking of specific backlink
- `test` - Test socket connectivity

## Environment Configuration

Create `.env.local` in root:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Architecture Notes

- **Job Storage**: Currently uses in-memory Map (consider Redis + BullMQ for production)
- **URL Normalization**: Backend normalizes URLs and anchor text for flexible matching
- **Error Handling**: Distinguishes between timeouts, HTTP errors, and general failures  
- **Rate Limiting**: 1-second delay between requests to avoid overwhelming target servers
- **Responsive Design**: Table-based results with mobile-friendly components

## Backend Dependencies

The server has its own `package.json` in `server/` with dependencies like `express`, `socket.io`, `axios`, `cheerio`, and `cors`.