"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { BacklinkJob } from "@/app/page";

interface BacklinkResultsProps {
  jobId: string;
  jobs: BacklinkJob[];
  onJobUpdate: (job: BacklinkJob) => void;
}

export function BacklinkResults({ jobId, jobs, onJobUpdate }: BacklinkResultsProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");
    setSocket(newSocket);

    newSocket.emit("join", { jobId });

    newSocket.on("progress", (data: { jobId: string; progress: number; job: BacklinkJob }) => {
      if (data.jobId === jobId) {
        setProgress(data.progress);
        onJobUpdate(data.job);
      }
    });

    newSocket.on("complete", (data: { jobId: string; progress: number }) => {
      if (data.jobId === jobId) {
        setProgress(100);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [jobId, onJobUpdate]);

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
    a.download = `backlink-results-${jobId}.csv`;
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

  return (
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
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
