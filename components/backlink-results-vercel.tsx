"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { BacklinkJob } from "@/app/page";

interface BacklinkResultsProps {
  jobs: BacklinkJob[];
  onJobUpdate: (job: BacklinkJob) => void;
  onComplete: () => void;
}

export function BacklinkResultsVercel({ jobs, onJobUpdate, onComplete }: BacklinkResultsProps) {
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (jobs.length > 0 && !processing) {
      processJobs();
    }
  }, [jobs]);

  const processJobs = async () => {
    setProcessing(true);
    
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      
      // Update status to checking
      const checkingJob = { ...job, status: 'checking' as const };
      onJobUpdate(checkingJob);
      setCurrentIndex(i);
      
      try {
        const response = await fetch('/api/check-single', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            urlFrom: job.urlFrom,
            urlTo: job.urlTo,
            anchorText: job.anchorText,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        const updatedJob: BacklinkJob = {
          ...job,
          status: result.found ? 'found' : 'not-found',
          found: result.found,
          statusCode: result.statusCode,
          error: result.error,
        };
        
        onJobUpdate(updatedJob);
        
        // Small delay to avoid overwhelming servers
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (error) {
        const errorJob: BacklinkJob = {
          ...job,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        onJobUpdate(errorJob);
      }
    }
    
    setProcessing(false);
    onComplete();
  };

  const handleExportCSV = () => {
    const csv = [
      "url_from,url_to,anchor_text,found,status,status_code,error",
      ...jobs.map(job => 
        `"${job.urlFrom}","${job.urlTo}","${job.anchorText}",${job.found || false},${job.status},${job.statusCode || ''},"${job.error || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backlink-results-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (job: BacklinkJob) => {
    switch (job.status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'checking':
        return <Badge variant="outline">Checking...</Badge>;
      case 'found':
        return <Badge variant="default">Found</Badge>;
      case 'not-found':
        return <Badge variant="destructive">Not Found</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const completedJobs = jobs.filter(job => ['found', 'not-found', 'error'].includes(job.status)).length;
  const totalJobs = jobs.length;
  const progressPercentage = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Progress: {completedJobs} / {totalJobs} completed
            {processing && currentIndex < totalJobs && (
              <span className="ml-2">
                (Currently checking: {currentIndex + 1})
              </span>
            )}
          </p>
          <Progress value={progressPercentage} className="w-64" />
        </div>
        <Button onClick={handleExportCSV} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>URL From</TableHead>
            <TableHead>URL To</TableHead>
            <TableHead>Anchor Text</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Status Code</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job, index) => (
            <TableRow 
              key={job.id}
              className={processing && index === currentIndex ? 'bg-blue-50' : ''}
            >
              <TableCell className="font-mono text-sm max-w-xs truncate">
                {job.urlFrom}
              </TableCell>
              <TableCell className="font-mono text-sm max-w-xs truncate">
                {job.urlTo}
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {job.anchorText}
              </TableCell>
              <TableCell>
                {getStatusBadge(job)}
              </TableCell>
              <TableCell>
                {job.statusCode && (
                  <span className="font-mono text-sm">{job.statusCode}</span>
                )}
                {job.error && (
                  <span className="text-sm text-destructive" title={job.error}>
                    Error
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
