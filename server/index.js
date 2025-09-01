const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// In-memory job storage (use Redis in production)
const jobs = new Map();
const jobProgress = new Map();

// Job processing queue
const processQueue = async () => {
  for (const [jobId, jobData] of jobs.entries()) {
    if (jobData.status === 'pending') {
      processJob(jobId, jobData);
    }
  }
};

const processJob = async (jobId, jobData) => {
  console.log(`Processing job ${jobId} with ${jobData.jobs.length} items`);
  
  jobData.status = 'processing';
  let completed = 0;
  const total = jobData.jobs.length;
  
  for (const job of jobData.jobs) {
    try {
      // Update job status to checking
      job.status = 'checking';
      
      // Emit progress update
      const progress = Math.round((completed / total) * 100);
      io.emit('progress', { jobId, progress, job });
      
      // Check for backlink
      const result = await checkBacklink(job.urlFrom, job.urlTo, job.anchorText);
      
      // Update job with result
      Object.assign(job, result);
      job.status = result.found ? 'found' : 'not-found';
      
      completed++;
      
      // Emit final progress update for this job
      const finalProgress = Math.round((completed / total) * 100);
      io.emit('progress', { jobId, progress: finalProgress, job });
      
      // Small delay to avoid overwhelming target servers
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error checking backlink for job ${job.id}:`, error);
      job.status = 'error';
      job.error = error.message;
      completed++;
      
      const progress = Math.round((completed / total) * 100);
      io.emit('progress', { jobId, progress, job });
    }
  }
  
  jobData.status = 'completed';
  io.emit('complete', { jobId, progress: 100 });
  console.log(`Job ${jobId} completed`);
};

// Normalize URL for comparison
const normalizeUrl = (url) => {
  if (!url) return '';
  
  // Convert to lowercase and remove protocol
  let normalized = url.toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '');
  
  // Remove www prefix
  normalized = normalized.replace(/^www\./, '');
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  // Remove query parameters and anchors
  normalized = normalized.split('?')[0].split('#')[0];
  
  return normalized;
};

// Normalize text for comparison
const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
};

const checkBacklink = async (urlFrom, urlTo, anchorText) => {
  try {
    console.log(`Checking backlink from ${urlFrom} to ${urlTo} with anchor "${anchorText}"`);
    
    // Normalize target URL and anchor text for comparison
    const normalizedTargetUrl = normalizeUrl(urlTo);
    const normalizedAnchorText = normalizeText(anchorText);
    
    // Fetch the source page with better headers
    const response = await axios.get(urlFrom, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 400, // Accept redirects
    });
    
    // Parse HTML with Cheerio
    const $ = cheerio.load(response.data);
    
    // Look for links that match the target URL
    let found = false;
    let matchDetails = '';
    
    $('a').each((i, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      
      if (!href) return;
      
      // Handle relative URLs by converting to absolute
      let absoluteHref = href;
      if (href.startsWith('/')) {
        const urlObj = new URL(urlFrom);
        absoluteHref = `${urlObj.protocol}//${urlObj.host}${href}`;
      } else if (!href.startsWith('http')) {
        const urlObj = new URL(urlFrom);
        absoluteHref = `${urlObj.protocol}//${urlObj.host}/${href}`;
      }
      
      const normalizedHref = normalizeUrl(absoluteHref);
      const normalizedLinkText = normalizeText(text);
      
      // Check if this link points to our target URL
      const urlMatches = normalizedHref.includes(normalizedTargetUrl) || normalizedTargetUrl.includes(normalizedHref);
      
      // Check anchor text - be more flexible
      const textMatches = !anchorText || normalizedLinkText.includes(normalizedAnchorText) || normalizedAnchorText.includes(normalizedLinkText);
      
      if (urlMatches && textMatches) {
        found = true;
        matchDetails = `Found link: "${text}" -> ${href}`;
        console.log(`✓ ${matchDetails}`);
        return false; // Break the loop
      }
    });
    
    if (!found) {
      console.log(`✗ No matching link found for ${normalizedTargetUrl} with text "${anchorText}"`);
      
      // Debug: Show first few links found on the page
      const allLinks = [];
      $('a').each((i, element) => {
        if (i < 5) { // Only show first 5 links
          const href = $(element).attr('href');
          const text = $(element).text().trim();
          if (href && text) {
            allLinks.push(`"${text}" -> ${href}`);
          }
        }
      });
      console.log(`Sample links found:`, allLinks);
    }
    
    return {
      found,
      statusCode: response.status,
      error: null,
      matchDetails: found ? matchDetails : null
    };
    
  } catch (error) {
    console.error(`Error fetching ${urlFrom}:`, error.message);
    
    return {
      found: false,
      statusCode: error.response?.status || null,
      error: error.message
    };
  }
};

// API Routes
app.post('/api/jobs', (req, res) => {
  const { jobId, jobs: jobItems } = req.body;
  
  if (!jobId || !jobItems || !Array.isArray(jobItems)) {
    return res.status(400).json({ error: 'Invalid job data' });
  }
  
  // Store job
  jobs.set(jobId, {
    id: jobId,
    jobs: jobItems,
    status: 'pending',
    createdAt: new Date()
  });
  
  console.log(`Received job ${jobId} with ${jobItems.length} items`);
  
  // Start processing (in production, this would be handled by a proper queue)
  setImmediate(() => processQueue());
  
  res.json({ success: true, jobId });
});

app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join', ({ jobId }) => {
    console.log(`Client ${socket.id} joined job ${jobId}`);
    socket.join(jobId);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backlink checker server running on port ${PORT}`);
});
