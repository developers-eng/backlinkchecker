# MADX Backlink Checker

A secure, full-stack application for checking backlinks across multiple websites with real-time progress updates and domain rating integration.

## Features

### Core Functionality
- **CSV Upload**: Upload a CSV file with backlink data
- **Manual Input**: Enter backlink data manually in CSV format  
- **Table Input**: Spreadsheet-like table interface for data entry
- **Real-time Updates**: Live progress updates via Socket.io
- **Export Results**: Download results as CSV
- **Recrawl Feature**: Re-check failed or error backlinks individually

### Authentication & Security
- **Secure Login**: Environment-based authentication system
- **Session Management**: HTTP-only cookie sessions
- **Protected Routes**: Application access control

### Advanced Features
- **Domain Rating**: Integration with Ahrefs API for domain rating data
- **Error Handling**: Comprehensive error states (timeout, HTTP errors, general failures)
- **Rate Limiting**: Respectful 1-second delays between requests
- **Progress Tracking**: Real-time job status updates
- **Responsive Design**: Mobile-friendly table interface

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

### 3. Configure Environment

Set up your environment variables in `.env.local`:
```bash
# Copy the example and update with your credentials
NEXT_PUBLIC_API_URL=http://localhost:4000
APP_USER=your_username
APP_PW=your_password  
AHREFS_API=your_ahrefs_api_key
```

### 4. Access the Application

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

**Login**: Use the credentials you set in `APP_USER` and `APP_PW` to access the application.

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

### Authentication API
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout
- `GET /api/auth/status` - Check authentication status

### Frontend API
- `POST /api/check` - Submit backlink check job
- `POST /api/check-single` - Check single backlink

### Backend API
- `POST /api/jobs` - Create new job
- `GET /api/jobs/:jobId` - Get job status
- `POST /api/recrawl` - Recrawl specific backlink

### Socket.io Events
- `join` - Join job room for updates
- `progress` - Receive job progress updates  
- `complete` - Job completion notification
- `recrawl` - Recrawl specific backlink
- `test` - Test socket connectivity

## Development

### Environment Variables
Create `.env.local` in the root directory:
```
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000

# Authentication Credentials  
APP_USER=your_username
APP_PW=your_password

# Ahrefs API Integration
AHREFS_API=your_ahrefs_api_key
```

**Important**: Update `APP_USER` and `APP_PW` with your desired login credentials. These are required for accessing the application.

### Project Structure
```
├── app/                     # Next.js app directory
│   ├── api/
│   │   ├── auth/           # Authentication API routes
│   │   │   ├── login/      # Login endpoint  
│   │   │   ├── logout/     # Logout endpoint
│   │   │   └── status/     # Auth status check
│   │   ├── check/          # Backlink check job submission
│   │   └── check-single/   # Single backlink check
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main page with auth logic
├── components/             # React components
│   ├── ui/                # Shadcn UI components
│   ├── backlink-input.tsx # CSV upload & manual input
│   ├── backlink-results.tsx # Results table with export
│   └── login-form.tsx     # Authentication form
├── lib/                   # Utilities (cn function, etc.)
├── server/                # Backend Express server
│   ├── index.js           # Main server with Socket.io & job processing
│   └── package.json       # Backend dependencies
└── package.json           # Frontend dependencies
```

## Production Deployment

### Vercel Deployment
This application is optimized for Vercel deployment:

1. **Environment Variables**: Set in Vercel project settings:
   - `APP_USER` - Your login username
   - `APP_PW` - Your login password
   - `AHREFS_API` - Your Ahrefs API key
   - `NEXT_PUBLIC_API_URL` - Your backend server URL

2. **Backend Hosting**: Deploy the `server/` directory separately (Railway, Render, etc.)

### Production Considerations

1. **Job Queue**: Replace in-memory storage with Redis + BullMQ
2. **Database**: Store job results in a proper database  
3. **Rate Limiting**: Enhanced rate limiting for web scraping
4. **Proxy Rotation**: Use proxy servers for large-scale checking
5. **Error Handling**: Enhanced error handling and retry logic
6. **Monitoring**: Add logging and monitoring
7. **Scaling**: Use horizontal scaling for job processing
8. **Security**: Consider additional security measures for production use

## License

MIT License
