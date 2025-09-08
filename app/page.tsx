"use client";

import { useState } from "react";
import { BacklinkInput } from "@/components/backlink-input";
import { BacklinkResults } from "@/components/backlink-results";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface BacklinkJob {
  id: string;
  urlFrom: string;
  urlTo: string;
  anchorText: string;
  status: 'pending' | 'checking' | 'found' | 'not-found' | 'error' | 'timeout';
  found?: boolean;
  statusCode?: number;
  error?: string;
}

export default function Home() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<BacklinkJob[]>([]);

  const handleJobStart = (jobId: string, initialJobs: BacklinkJob[]) => {
    setCurrentJobId(jobId);
    setJobs(initialJobs);
  };

  const handleJobUpdate = (updatedJob: BacklinkJob) => {
    setJobs(prev => prev.map(job => 
      job.id === updatedJob.id ? updatedJob : job
    ));
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">MADX Backlink Checker</h1>
        <p className="text-muted-foreground">
          Check if your backlinks exist across multiple websites
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Input Backlinks</CardTitle>
          <CardDescription>
            Upload a CSV file or manually enter the URLs you want to check
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BacklinkInput onJobStart={handleJobStart} />
        </CardContent>
      </Card>

      {currentJobId && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              Live results of your backlink check
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BacklinkResults 
              jobId={currentJobId} 
              jobs={jobs}
              onJobUpdate={handleJobUpdate}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
