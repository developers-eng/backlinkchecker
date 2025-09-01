# Backlink Checker - Vercel Deployment

This is a Vercel-optimized version of the Backlink Checker that works within Vercel's hobby plan limitations.

## ✅ Vercel Hobby Plan Compatibility

### What Works:
- **Frontend hosting** - Full Next.js app with Shadcn UI
- **Serverless API routes** - Individual backlink checks
- **Static file serving** - All assets and components
- **Sequential processing** - Processes one link at a time within timeout limits

### What's Different from Local Version:
- **No real-time WebSocket updates** - Uses sequential HTTP requests instead
- **No persistent background server** - Uses serverless functions
- **10-second timeout per check** - Optimized for Vercel's limits
- **Sequential processing** - Processes links one by one with delays

## 🚀 Deploy to Vercel

### One-Click Deploy:
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/backlink-checker)

### Manual Deploy:
1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Deploy automatically

### Environment Variables:
No environment variables required for basic functionality.

## 📋 Usage on Vercel

1. **Upload/Input Data**: Same as local version
2. **Processing**: Links are checked sequentially (not real-time)
3. **Progress**: Visual progress bar updates as each check completes
4. **Export**: Same CSV export functionality

## ⚡ Performance Considerations

### Hobby Plan Limits:
- **10-second timeout** per serverless function
- **1GB bandwidth** per month
- **100GB-hours** compute time per month

### Optimization:
- Each backlink check is optimized to complete under 8 seconds
- 1.5-second delay between requests to avoid rate limiting
- Efficient error handling for blocked requests

## 🔧 Technical Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Route     │    │   Target Site   │
│   (Static)      │───▶│   (Serverless)  │───▶│   (Scraping)    │
│                 │    │                 │    │                 │
│ • Input forms   │    │ • Single check  │    │ • HTML parsing  │
│ • Results table │    │ • 8s timeout    │    │ • Link finding  │
│ • Progress bar  │    │ • Error handling│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛡️ Terms of Service Compliance

### Vercel Hobby Plan:
- ✅ **Web scraping**: Not explicitly forbidden
- ✅ **Resource usage**: Within compute limits
- ✅ **Use case**: Legitimate SEO tool
- ⚠️ **Rate limiting**: Built-in delays to be respectful

### Best Practices:
- Respectful scraping with delays
- Proper User-Agent headers
- Error handling for blocked requests
- No persistent background processes

## 📊 Estimated Usage

### For Hobby Plan:
- **~200 backlink checks/month** (conservative estimate)
- **~5-10 minutes** per batch of 20 links
- **Well within** bandwidth and compute limits

### Scaling Options:
- **Pro Plan**: $20/month for higher limits
- **Team Plan**: $20/month per user for team usage

## 🔄 Migration from Local Version

If you want to use both versions:

1. **Local Development**: Use the full Express + Socket.io version
2. **Production**: Deploy the Vercel-optimized version
3. **Features**: Core functionality is identical

## 🚨 Limitations

1. **No real-time updates** - Sequential processing instead
2. **Slower processing** - Delays between requests
3. **10-second per-request limit** - Some complex sites may timeout
4. **Monthly limits** - Hobby plan has usage restrictions

## 💡 Alternative Hosting Options

If you need real-time features:

1. **Railway**: $5/month, supports WebSockets
2. **Render**: Free tier with limitations
3. **Digital Ocean App Platform**: $5/month
4. **Heroku**: $7/month (no free tier anymore)

## 📝 License

MIT License - Same as the main project
