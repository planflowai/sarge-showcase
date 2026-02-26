'use client';

import { useResumeTailorStore, type JobResult } from '../../resumeTailorStore';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, MapPin, Calendar } from 'lucide-react';

interface StageJobSearchProps {
  providerStore: any;
}

export function StageJobSearch({ providerStore }: StageJobSearchProps) {
  const store = useResumeTailorStore();
  const { jobSearchResults, isSearching } = store;

  const handleViewJob = (url: string) => {
    window.open(url, '_blank');
  };

  const handleTailorForJob = async (job: JobResult) => {
    // Pre-fill the job posting with a placeholder
    // The user will need to manually fetch/paste the actual job description
    const jobPostingTemplate = `Position: ${job.title}
Company: ${job.company}
Location: ${job.location}
Posted: ${job.postedDate}
URL: ${job.url}

[Please paste the full job description here, then click Analyze]`;

    store.setJobPosting(jobPostingTemplate);
    store.setStage(0); // Go back to input stage with job posting pre-filled
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
          Similar Job Postings
        </h2>
        <p className="text-sm text-zinc-400">
          Click "View Job" to verify the posting, then "Tailor Resume" to apply to that specific role.
        </p>
      </div>

      {isSearching ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-indigo-400 animate-spin mb-3" />
          <p className="text-sm text-zinc-400">Searching for similar jobs...</p>
        </div>
      ) : jobSearchResults.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-sm text-zinc-400">No jobs found. Try searching again or adjust your criteria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobSearchResults.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 hover:border-indigo-500/40 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-3">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-zinc-100 mb-1">
                    {job.title}
                  </h3>
                  <p className="text-sm text-indigo-400 font-medium mb-2">
                    {job.company}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                    {job.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.location}
                      </div>
                    )}
                    {job.postedDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {job.postedDate}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleViewJob(job.url)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-300 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Job
                </button>
                <button
                  onClick={() => handleTailorForJob(job)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                >
                  Tailor Resume →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Back and New Search Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => store.setStage(4)}
          variant="outline"
          size="lg"
        >
          ← Back to Download
        </Button>
        <Button
          onClick={() => {
            store.setJobSearchResults([]);
            store.setStage(4); // Go back to cover letter to search again
          }}
          variant="outline"
          size="lg"
        >
          New Search
        </Button>
      </div>
    </div>
  );
}
