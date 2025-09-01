# Backlink Checker MVP

A full-stack application for checking backlinks across multiple websites with real-time progress updates.

## Features

- **CSV Upload**: Upload a CSV file with backlink data
- **Manual Input**: Enter backlink data manually in CSV format
- **Real-time Updates**: Live progress updates via Socket.io
- **Beautiful UI**: Built with Shadcn UI components
- **Export Results**: Download results as CSV

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- Shadcn UI components
- Socket.io client
- TypeScript
- Tailwind CSS

### Backend
- Node.js + Express
- Socket.io server
- Axios + Cheerio for web scraping
- In-memory job queue

## Quick Start

### 1. Install Dependencies

Frontend:
```bash
npm install
```

Backend:
```bash
cd server
npm install
cd ..
```

### 2. Start the Application

Start both frontend and backend:
```bash
npm run dev:all
```

Or start them separately:

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run dev
```

### 3. Access the Application

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

## Usage

### CSV Format
```csv
url_from,url_to,anchor_text
https://example.com/page,https://your-site.com,SEO Tools
https://blog.com/post,https://your-site.com,Click Here
```

### Manual Input
Enter data in the same CSV format, one line per backlink.

## How It Works

1. **Input**: User uploads CSV or enters data manually
2. **Job Creation**: Frontend sends data to Next.js API route
3. **Job Processing**: API route forwards job to backend server
4. **Backlink Checking**: Backend uses Axios + Cheerio to:
   - Fetch the source page
   - Parse HTML and search for links
   - Check if target URL and anchor text exist
5. **Real-time Updates**: Progress sent via Socket.io
6. **Results**: Live table updates and CSV export

## API Endpoints

### Frontend API
- `POST /api/check` - Submit backlink check job

### Backend API
- `POST /api/jobs` - Create new job
- `GET /api/jobs/:jobId` - Get job status

### Socket.io Events
- `join` - Join job room for updates
- `progress` - Receive job progress updates
- `complete` - Job completion notification

## Development

### Environment Variables
Create `.env.local` in the root directory:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Project Structure
```
├── app/                 # Next.js app directory
│   ├── api/check/      # API route for job submission
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Main page component
├── components/         # React components
│   ├── ui/            # Shadcn UI components
│   ├── backlink-input.tsx
│   └── backlink-results.tsx
├── lib/               # Utilities
├── server/            # Backend server
│   ├── index.js       # Express server with Socket.io
│   └── package.json   # Backend dependencies
└── package.json       # Frontend dependencies
```

## Production Considerations

For production deployment, consider:

1. **Job Queue**: Replace in-memory storage with Redis + BullMQ
2. **Database**: Store job results in a proper database
3. **Rate Limiting**: Add rate limiting for web scraping
4. **Proxy Rotation**: Use proxy servers for large-scale checking
5. **Error Handling**: Enhanced error handling and retry logic
6. **Authentication**: Add user authentication if needed
7. **Monitoring**: Add logging and monitoring
8. **Scaling**: Use horizontal scaling for job processing

## License

MIT License
