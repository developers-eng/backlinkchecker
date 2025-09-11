import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const type = formData.get('type') as string;
    
    let backlinkData: Array<{urlFrom: string, urlTo: string, anchorText: string}> = [];
    
    if (type === 'csv') {
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header if it exists
      const dataLines = lines[0].includes('url_from') ? lines.slice(1) : lines;
      
      backlinkData = dataLines.map(line => {
        const [urlFrom, urlTo, anchorText] = line.split(',').map(item => item.trim().replace(/"/g, ''));
        return { urlFrom, urlTo, anchorText };
      }).filter(item => item.urlFrom && item.urlTo);
      
    } else if (type === 'manual') {
      const data = formData.get('data') as string;
      if (!data) {
        return NextResponse.json({ error: 'No data provided' }, { status: 400 });
      }
      
      const lines = data.split('\n').filter(line => line.trim());
      const dataLines = lines[0].includes('url_from') ? lines.slice(1) : lines;
      
      backlinkData = dataLines.map(line => {
        const [urlFrom, urlTo, anchorText] = line.split(',').map(item => item.trim().replace(/"/g, ''));
        return { urlFrom, urlTo, anchorText };
      }).filter(item => item.urlFrom && item.urlTo);
    }
    
    if (backlinkData.length === 0) {
      return NextResponse.json({ error: 'No valid backlink data found' }, { status: 400 });
    }
    
    const jobId = uuidv4();
    
    // Create job objects
    const jobs = backlinkData.map(item => ({
      id: uuidv4(),
      urlFrom: item.urlFrom,
      urlTo: item.urlTo,
      anchorText: item.anchorText,
      status: 'pending' as const
    }));
    
    // Send job to backend server
    try {
      await fetch(`http://localhost:${process.env.PORT || 3000}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, jobs }),
      });
    } catch (error) {
      console.error('Failed to submit job to backend:', error);
      return NextResponse.json({ error: 'Backend server not available' }, { status: 503 });
    }
    
    return NextResponse.json({ jobId, jobs });
    
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
