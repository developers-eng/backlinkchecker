const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

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
      
      // Get domain rating for urlFrom
      const domainRatingResult = await getDomainRating(job.urlFrom);
      
      // Update job with result
      Object.assign(job, result, domainRatingResult);
      job.status = result.found ? 'found' : 'not-found';
      
      completed++;
      
      // Emit final progress update for this job
      const finalProgress = Math.round((completed / total) * 100);
      io.emit('progress', { jobId, progress: finalProgress, job });
      
      // Small delay to avoid overwhelming target servers
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error checking backlink for job ${job.id}:`, error);
      
      // Check if it's a timeout error
      if (error.message && error.message.includes('timeout')) {
        job.status = 'timeout';
      } else {
        job.status = 'error';
      }
      
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

// Get domain rating from Ahrefs API
const getDomainRating = async (url) => {
  const AHREFS_API_KEY = process.env.AHREFS_API;
  
  if (!AHREFS_API_KEY) {
    console.log('Ahrefs API key not found, skipping domain rating check');
    return { domainRating: null, domainRatingError: 'API key not configured' };
  }

  try {
    // Extract domain from URL
    const domain = new URL(url).hostname;
    
    console.log(`Getting domain rating for ${domain} using API v3`);
    
    // Format current date as YYYY-MM-DD as required by API
    const currentDate = new Date().toISOString().split('T')[0];
    
    const response = await axios.get(`https://api.ahrefs.com/v3/site-explorer/domain-rating?target=${encodeURIComponent(domain)}&date=${encodeURIComponent(currentDate)}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${AHREFS_API_KEY}`
      },
      timeout: 10000
    });

    // Log the full response for debugging
    console.log('Ahrefs API v3 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.domain_rating && response.data.domain_rating.domain_rating !== undefined) {
      const domainRating = response.data.domain_rating.domain_rating;
      // Handle the special case where domain rating is -3.402823669209385e+38 (indicates no data)
      if (domainRating < 0 || domainRating > 100) {
        console.log(`✗ No valid domain rating data for ${domain} (value: ${domainRating})`);
        return { domainRating: null, domainRatingError: 'No domain rating data available' };
      }
      console.log(`✓ Domain rating for ${domain}: ${domainRating}`);
      return { domainRating: Math.round(domainRating), domainRatingError: null };
    } else {
      console.log(`✗ No domain rating data found for ${domain}`);
      return { domainRating: null, domainRatingError: 'No domain rating data available' };
    }
  } catch (error) {
    console.error(`Error getting domain rating for ${url}:`, error.message);
    
    // Log detailed error response if available
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', error.response.data);
      console.error('Headers:', error.response.headers);
    }
    
    return { domainRating: null, domainRatingError: error.message };
  }
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

  // Test event to verify socket communication
  socket.on('test', (data) => {
    console.log('[TEST] Test event received:', data);
    socket.emit('test-response', { message: 'Server received test event' });
  });

  socket.on('recrawl', async ({ jobId, jobToRecrawl }) => {
    console.log(`[RECRAWL] Recrawl requested for job ${jobToRecrawl.id} in ${jobId}`);
    console.log(`[RECRAWL] Socket ID: ${socket.id}`);
    console.log(`[RECRAWL] Job data:`, { urlFrom: jobToRecrawl.urlFrom, urlTo: jobToRecrawl.urlTo });
    
    const jobData = jobs.get(jobId);
    if (!jobData) {
      console.error(`Job ${jobId} not found for recrawl`);
      // Inform the requesting client so UI doesn't stay stuck on "Checking..."
      const errorJob = {
        id: jobToRecrawl.id,
        urlFrom: jobToRecrawl.urlFrom,
        urlTo: jobToRecrawl.urlTo,
        anchorText: jobToRecrawl.anchorText,
        status: 'error',
        found: false,
        statusCode: null,
        error: 'Job not found on server (it may have restarted)'
      };
      socket.emit('progress', { jobId, progress: null, job: errorJob });
      return;
    }

    // Find the specific job item to recrawl
    const jobItem = jobData.jobs.find(j => j.id === jobToRecrawl.id);
    if (!jobItem) {
      console.error(`Job item ${jobToRecrawl.id} not found for recrawl`);
      const errorJob = {
        id: jobToRecrawl.id,
        urlFrom: jobToRecrawl.urlFrom,
        urlTo: jobToRecrawl.urlTo,
        anchorText: jobToRecrawl.anchorText,
        status: 'error',
        found: false,
        statusCode: null,
        error: 'Job item not found on server'
      };
      socket.emit('progress', { jobId, progress: null, job: errorJob });
      return;
    }

    try {
      // Reset job status
      jobItem.status = 'checking';
      jobItem.error = null;
      jobItem.found = false;
      jobItem.statusCode = null;

      // Emit progress update showing it's being recrawled
      io.to(jobId).emit('progress', { jobId, progress: null, job: jobItem });

      // Re-check the backlink
      const result = await checkBacklink(jobItem.urlFrom, jobItem.urlTo, jobItem.anchorText);
      
      // Update job with new result (preserve existing domain rating)
      Object.assign(jobItem, result);
      
      // Set appropriate status based on result
      if (result.error) {
        if (result.error.includes('timeout')) {
          jobItem.status = 'timeout';
        } else {
          jobItem.status = 'error';
        }
      } else {
        jobItem.status = result.found ? 'found' : 'not-found';
      }
      
      // Emit the updated result
      io.to(jobId).emit('progress', { jobId, progress: null, job: jobItem });
      
      console.log(`Recrawl completed for job ${jobToRecrawl.id}`);
    } catch (error) {
      console.error(`Error during recrawl of job ${jobToRecrawl.id}:`, error);
      
      // Check if it's a timeout error
      if (error.message && error.message.includes('timeout')) {
        jobItem.status = 'timeout';
      } else {
        jobItem.status = 'error';
      }
      
      jobItem.error = error.message;
      
      // Emit error result
      io.to(jobId).emit('progress', { jobId, progress: null, job: jobItem });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Single backlink check endpoint
app.post('/api/check-single', async (req, res) => {
  try {
    const { urlFrom, urlTo, anchorText } = req.body;
    
    if (!urlFrom || !urlTo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await checkBacklink(urlFrom, urlTo, anchorText || '');
    
    res.json({
      urlFrom,
      urlTo,
      anchorText,
      found: result.found,
      statusCode: result.statusCode,
      error: result.error,
      matchDetails: result.matchDetails
    });
    
  } catch (error) {
    console.error('Error checking single backlink:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backlink checker server running on port ${PORT}`);
});
