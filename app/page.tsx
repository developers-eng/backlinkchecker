"use client";

import { useState, useEffect } from "react";
import { BacklinkInput } from "@/components/backlink-input";
import { BacklinkResults } from "@/components/backlink-results";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface BacklinkJob {
  id: string;
  urlFrom: string;
  urlTo: string;
  anchorText: string;
  status: 'pending' | 'checking' | 'found' | 'not-found' | 'error' | 'timeout';
  found?: boolean;
  statusCode?: number;
  error?: string;
  domainRating?: number;
  domainRatingError?: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
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

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/status");
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  const handleLogin = (success: boolean) => {
    if (success) {
      setIsAuthenticated(true);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsAuthenticated(false);
      setCurrentJobId(null);
      setJobs([]);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Loading...</h1>
          <p className="text-muted-foreground">Checking authentication status</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div className="text-center flex-1">
          <h1 className="text-4xl font-bold mb-2">MADX Backlink Checker</h1>
          <p className="text-muted-foreground">
            Check if your backlinks exist across multiple websites
          </p>
        </div>
        <Button 
          onClick={handleLogout} 
          variant="outline"
          className="ml-4"
        >
          Logout
        </Button>
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
