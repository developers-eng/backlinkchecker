import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Normalize URL for comparison
const normalizeUrl = (url: string) => {
  if (!url) return '';
  
  let normalized = url.toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/$/, '');
  normalized = normalized.split('?')[0].split('#')[0];
  
  return normalized;
};

// Normalize text for comparison
const normalizeText = (text: string) => {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
};

const checkBacklink = async (urlFrom: string, urlTo: string, anchorText: string) => {
  try {
    const normalizedTargetUrl = normalizeUrl(urlTo);
    const normalizedAnchorText = normalizeText(anchorText);
    
    const response = await axios.get(urlFrom, {
      timeout: 8000, // Keep under 10s Vercel limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
      },
      maxRedirects: 3,
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
    
    return {
      found,
      statusCode: response.status,
      error: null,
      matchDetails: found ? matchDetails : null
    };
    
  } catch (error: any) {
    return {
      found: false,
      statusCode: error.response?.status || null,
      error: error.message
    };
  }
};

export async function POST(request: NextRequest) {
  try {
    const { urlFrom, urlTo, anchorText } = await request.json();
    
    if (!urlFrom || !urlTo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const result = await checkBacklink(urlFrom, urlTo, anchorText || '');
    
    return NextResponse.json({
      urlFrom,
      urlTo,
      anchorText,
      ...result
    });
    
  } catch (error) {
    console.error('Error checking backlink:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
