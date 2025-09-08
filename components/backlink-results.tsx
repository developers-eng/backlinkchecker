"use client";

import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Download, MoreHorizontal, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BacklinkJob } from "@/app/page";

interface BacklinkResultsProps {
  jobId: string;
  jobs: BacklinkJob[];
  onJobUpdate: (job: BacklinkJob) => void;
}

export function BacklinkResults({ jobId, jobs, onJobUpdate }: BacklinkResultsProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [progress, setProgress] = useState(0);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  useEffect(() => {
    console.log('[SOCKET] Creating new socket connection');
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log('[SOCKET] Connected to server');
      newSocket.emit("join", { jobId });
      console.log('[SOCKET] Joined job room:', jobId);
    });

    newSocket.on("disconnect", () => {
      console.log('[SOCKET] Disconnected from server');
    });

    newSocket.on("progress", (data: { jobId: string; progress: number; job: BacklinkJob }) => {
      console.log('[SOCKET] Progress update received:', data);
      if (data.jobId === jobId) {
        setProgress(data.progress);
        onJobUpdate(data.job);
      }
    });

    newSocket.on("complete", (data: { jobId: string; progress: number }) => {
      console.log('[SOCKET] Job complete:', data);
      if (data.jobId === jobId) {
        setProgress(100);
      }
    });

    // Test event listener
    newSocket.on("test-response", (data) => {
      console.log('[TEST] Server response:', data);
    });

    return () => {
      console.log('[SOCKET] Cleaning up socket connection');
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const handleExportCSV = () => {
    const csv = [
      "url_from,url_to,anchor_text,found,status,status_code,error,domain_rating,domain_rating_error",
      ...jobs.map(job => 
        `"${job.urlFrom}","${job.urlTo}","${job.anchorText}",${job.found || false},${job.status},${job.statusCode || ''},"${job.error || ''}",${job.domainRating || ''},"${job.domainRatingError || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backlink-results-${jobId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const testSocket = () => {
    console.log('[TEST] Testing socket connection');
    if (!socket) {
      console.error('[TEST] No socket connection available');
      return;
    }
    socket.emit('test', { message: 'Test from client', timestamp: Date.now() });
    console.log('[TEST] Test event emitted');
  };

  const handleRecrawl = (job: BacklinkJob) => {
    console.log('[RECRAWL] handleRecrawl called for job:', job.id);
    
    if (!socket) {
      console.error('[RECRAWL] No socket connection available');
      return;
    }
    
    console.log('[RECRAWL] Socket connected, emitting recrawl event');
    
    // Test socket first
    testSocket();
    
    // Immediately update the job status locally to show it's being recrawled
    const updatedJob = {
      ...job,
      status: 'checking' as const,
      statusCode: undefined,
      error: undefined,
      found: undefined
    };
    onJobUpdate(updatedJob);
    
    socket.emit("recrawl", {
      jobId: jobId,
      jobToRecrawl: {
        id: job.id,
        urlFrom: job.urlFrom,
        urlTo: job.urlTo,
        anchorText: job.anchorText
      }
    });
    
    console.log('[RECRAWL] Recrawl event emitted');
  };

  const copyToClipboard = (text: string, cellId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCell(cellId);
      // Clear the feedback after 2 seconds
      setTimeout(() => setCopiedCell(null), 2000);
    }).catch((err) => {
      console.error('Failed to copy to clipboard:', err);
    });
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
      case 'timeout':
        return <Badge variant="destructive">Timeout</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const completedJobs = jobs.filter(job => ['found', 'not-found', 'error', 'timeout'].includes(job.status)).length;
  const totalJobs = jobs.length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Progress: {completedJobs} / {totalJobs} completed
          </p>
          <Progress value={progress} className="w-64" />
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
            <TableHead>Domain Rating</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-mono text-sm max-w-xs truncate">
                <a 
                  href={job.urlFrom} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {job.urlFrom}
                </a>
              </TableCell>
              <TableCell className="font-mono text-sm max-w-xs truncate">
                <Tooltip open={copiedCell === `urlTo-${job.id}` ? true : undefined}>
                  <TooltipTrigger asChild>
                    <span
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors block p-1 -m-1 rounded"
                      onClick={() => copyToClipboard(job.urlTo, `urlTo-${job.id}`)}
                    >
                      {job.urlTo}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {copiedCell === `urlTo-${job.id}` ? "Copied!" : "Click to copy"}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell className="max-w-xs truncate">
                <Tooltip open={copiedCell === `anchorText-${job.id}` ? true : undefined}>
                  <TooltipTrigger asChild>
                    <span
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors block p-1 -m-1 rounded"
                      onClick={() => copyToClipboard(job.anchorText, `anchorText-${job.id}`)}
                    >
                      {job.anchorText}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {copiedCell === `anchorText-${job.id}` ? "Copied!" : "Click to copy"}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                {getStatusBadge(job)}
              </TableCell>
              <TableCell>
                {job.statusCode && (
                  <span className="font-mono text-sm">{job.statusCode}&nbsp;</span>
                )}
                {job.error && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-destructive cursor-help underline decoration-dotted">
                        Error
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="break-words">{job.error}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell>
                {job.domainRating !== undefined && job.domainRating !== null ? (
                  <Badge variant={job.domainRating >= 50 ? "default" : job.domainRating >= 30 ? "secondary" : "outline"}>
                    DR {job.domainRating}
                  </Badge>
                ) : job.domainRatingError ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-help underline decoration-dotted">
                        N/A
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="break-words">{job.domainRatingError}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {((job.statusCode && job.statusCode !== 200) || job.status === 'error' || job.status === 'timeout' || job.error) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleRecrawl(job)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Recrawl
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </TooltipProvider>
  );
}
