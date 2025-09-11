const express = require('express');
const next = require('next');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

// Import your existing server logic
const jobs = new Map();
const jobProgress = new Map();

// Normalize URL for comparison
const normalizeUrl = (url) => {
  if (!url) return '';
  
  let normalized = url.toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/$/, '');
  normalized = normalized.split('?')[0].split('#')[0];
  
  return normalized;
};

// Normalize text for comparison
const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
};

// Get domain rating from Ahrefs API
const getDomainRating = async (domain) => {
  try {
    const ahrefs_api = process.env.AHREFS_API;
    if (!ahrefs_api) {
      return { domainRating: null, domainRatingError: 'Ahrefs API key not configured' };
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const url = `https://api.ahrefs.com/v3/site-explorer/domain-rating?target=${encodeURIComponent(cleanDomain)}&token=${ahrefs_api}`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BacklinkChecker/1.0'
      }
    });
    
    if (response.data && response.data.domain_rating !== undefined) {
      return { domainRating: response.data.domain_rating, domainRatingError: null };
    } else {
      return { domainRating: null, domainRatingError: 'No domain rating data available' };
    }
  } catch (error) {
    console.error('Error fetching domain rating:', error.response?.data || error.message);
    return { domainRating: null, domainRatingError: error.message };
  }
};

const checkBacklink = async (urlFrom, urlTo, anchorText) => {
  try {
    console.log(`Checking backlink from ${urlFrom} to ${urlTo} with anchor "${anchorText}"`);
    
    const normalizedTargetUrl = normalizeUrl(urlTo);
    const normalizedAnchorText = normalizeText(anchorText);
    
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
      validateStatus: (status) => status < 400,
    });
    
    const $ = cheerio.load(response.data);
    let found = false;
    let matchDetails = '';
    
    $('a').each((i, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      
      if (!href) return;
      
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
      
      const urlMatches = normalizedHref.includes(normalizedTargetUrl) || normalizedTargetUrl.includes(normalizedHref);
      const textMatches = !anchorText || normalizedLinkText.includes(normalizedAnchorText) || normalizedAnchorText.includes(normalizedLinkText);
      
      if (urlMatches && textMatches) {
        found = true;
        matchDetails = `Found link: "${text}" -> ${href}`;
        return false;
      }
    });
    
    if (found) {
      return {
        found: true,
        statusCode: response.status,
        error: null,
        matchDetails
      };
    } else {
      return {
        found: false,
        statusCode: response.status,
        error: null,
        matchDetails: null
      };
    }
    
  } catch (error) {
    console.error(`Error checking backlink from ${urlFrom}:`, error.message);
    
    if (error.code === 'ECONNABORTED') {
      return {
        found: false,
        statusCode: null,
        error: 'Request timeout'
      };
    }
    
    return {
      found: false,
      statusCode: error.response?.status || null,
      error: error.message
    };
  }
};

nextApp.prepare().then(() => {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post('/api/jobs', async (req, res) => {
    try {
      const { jobId, jobs: jobsData } = req.body;
      
      if (!jobId || !Array.isArray(jobsData)) {
        return res.status(400).json({ error: 'Invalid job data' });
      }

      jobs.set(jobId, {
        id: jobId,
        jobs: jobsData,
        status: 'pending',
        createdAt: new Date()
      });

      console.log(`Job ${jobId} created with ${jobsData.length} items`);
      res.json({ success: true, jobId });

      // Start processing after response
      setImmediate(() => processJob(jobId, jobs.get(jobId)));
      
    } catch (error) {
      console.error('Error creating job:', error);
      res.status(500).json({ error: 'Failed to create job' });
    }
  });

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

  const processJob = async (jobId, jobData) => {
    console.log(`Processing job ${jobId} with ${jobData.jobs.length} items`);
    
    jobData.status = 'processing';
    let completed = 0;
    const total = jobData.jobs.length;
    
    for (const job of jobData.jobs) {
      try {
        job.status = 'checking';
        
        const progress = Math.round((completed / total) * 100);
        io.emit('progress', { jobId, progress, job });
        
        const result = await checkBacklink(job.urlFrom, job.urlTo, job.anchorText);
        
        job.found = result.found;
        job.statusCode = result.statusCode;
        job.error = result.error;
        
        if (result.found) {
          job.status = 'found';
        } else if (result.error) {
          if (result.error.includes('timeout')) {
            job.status = 'timeout';
          } else {
            job.status = 'error';
          }
        } else {
          job.status = 'not-found';
        }

        // Get domain rating
        try {
          const domainResult = await getDomainRating(job.urlFrom);
          job.domainRating = domainResult.domainRating;
          job.domainRatingError = domainResult.domainRatingError;
        } catch (error) {
          job.domainRatingError = error.message;
        }
        
        completed++;
        const finalProgress = Math.round((completed / total) * 100);
        io.emit('progress', { jobId, progress: finalProgress, job });
        
        if (completed < total) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        job.status = 'error';
        job.error = error.message;
        completed++;
        const finalProgress = Math.round((completed / total) * 100);
        io.emit('progress', { jobId, progress: finalProgress, job });
      }
    }
    
    jobData.status = 'completed';
    io.emit('complete', { jobId });
    console.log(`Job ${jobId} completed`);
  };

  // Socket.IO
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('join', (jobId) => {
      socket.join(jobId);
      console.log(`Client ${socket.id} joined job ${jobId}`);
    });

    socket.on('test', () => {
      socket.emit('test-response', { message: 'Socket connection working!' });
    });

    socket.on('recrawl', async ({ jobId, jobToRecrawl }) => {
      const jobData = jobs.get(jobId);
      if (!jobData) {
        socket.emit('error', { message: 'Job not found' });
        return;
      }

      const jobItem = jobData.jobs.find(j => j.id === jobToRecrawl.id);
      if (!jobItem) {
        socket.emit('error', { message: 'Job item not found' });
        return;
      }

      try {
        jobItem.status = 'checking';
        io.to(jobId).emit('progress', { jobId, progress: null, job: jobItem });

        const result = await checkBacklink(jobItem.urlFrom, jobItem.urlTo, jobItem.anchorText);
        
        jobItem.found = result.found;
        jobItem.statusCode = result.statusCode;
        jobItem.error = result.error;
        
        if (result.found) {
          jobItem.status = 'found';
        } else if (result.error) {
          if (result.error.includes('timeout')) {
            jobItem.status = 'timeout';
          } else {
            jobItem.status = 'error';
          }
        } else {
          jobItem.status = 'not-found';
        }

        try {
          const domainResult = await getDomainRating(jobItem.urlFrom);
          jobItem.domainRating = domainResult.domainRating;
          jobItem.domainRatingError = domainResult.domainRatingError;
        } catch (error) {
          jobItem.domainRatingError = error.message;
        }

        io.to(jobId).emit('progress', { jobId, progress: null, job: jobItem });
        
      } catch (error) {
        console.error(`Error during recrawl of job ${jobToRecrawl.id}:`, error);
        
        if (error.message && error.message.includes('timeout')) {
          jobItem.status = 'timeout';
        } else {
          jobItem.status = 'error';
        }
        
        jobItem.error = error.message;
        io.to(jobId).emit('progress', { jobId, progress: null, job: jobItem });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Handle Next.js pages
  app.all('*', (req, res) => {
    return handle(req, res);
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});