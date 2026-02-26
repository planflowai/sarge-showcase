'use client';

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@sarge/core";

export type TailorStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface KeywordResult {
  keywords: string[];
  matched: string[];
  missing: string[];
  jobTitle: string;
  companyName: string;
  matchScore: number;
  matchTotal: number;
}

export interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  postedDate: string;
  url: string;
}

export interface ResumeTailorState {
  // --- Inputs (Stage 0) ---
  masterResume: string;
  jobPosting: string;

  // --- Model Selection ---
  analysisModel: string;
  tailorModel: string;

  // --- Stage tracking ---
  stage: TailorStage;
  isLoading: boolean;
  isStreaming: boolean;

  // --- Stage 1 results ---
  keywordResult: KeywordResult | null;

  // --- Stage 2 results ---
  tailoredResume: string;
  tailoredResumeStreaming: string;

  // --- Stage 3 results ---
  coverLetter: string;
  coverLetterStreaming: string;

  // --- Stage 5 results (Job Search) ---
  jobSearchResults: JobResult[];
  isSearching: boolean;

  // --- Error state ---
  error: string | null;

  // --- Actions ---
  setMasterResume: (text: string) => void;
  setJobPosting: (text: string) => void;
  setAnalysisModel: (model: string) => void;
  setTailorModel: (model: string) => void;
  setStage: (stage: TailorStage) => void;
  setKeywordResult: (result: KeywordResult) => void;
  appendTailoredResume: (token: string) => void;
  finalizeTailoredResume: () => void;
  setTailoredResume: (text: string) => void;
  appendCoverLetter: (token: string) => void;
  finalizeCoverLetter: () => void;
  setCoverLetter: (text: string) => void;
  setJobSearchResults: (jobs: JobResult[]) => void;
  setIsSearching: (v: boolean) => void;
  setIsLoading: (v: boolean) => void;
  setIsStreaming: (v: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const initialState = {
  masterResume: '',
  jobPosting: '',
  analysisModel: '',
  tailorModel: '',
  stage: 0 as TailorStage,
  isLoading: false,
  isStreaming: false,
  keywordResult: null,
  tailoredResume: '',
  tailoredResumeStreaming: '',
  coverLetter: '',
  coverLetterStreaming: '',
  jobSearchResults: [] as JobResult[],
  isSearching: false,
  error: null,
};

export const useResumeTailorStore = create<ResumeTailorState>()(
  persist(
    (set) => ({
      ...initialState,

      setMasterResume: (text: string) => set({ masterResume: text }),
      setJobPosting: (text: string) => set({ jobPosting: text }),
      setAnalysisModel: (model: string) => set({ analysisModel: model }),
      setTailorModel: (model: string) => set({ tailorModel: model }),
      setStage: (stage: TailorStage) => set({ stage }),
      setKeywordResult: (result: KeywordResult) => set({ keywordResult: result }),

      appendTailoredResume: (token: string) =>
        set((state) => ({
          tailoredResumeStreaming: state.tailoredResumeStreaming + token,
        })),

      finalizeTailoredResume: () =>
        set((state) => ({
          tailoredResume: state.tailoredResumeStreaming,
          tailoredResumeStreaming: '',
        })),

      setTailoredResume: (text: string) => set({ tailoredResume: text }),

      appendCoverLetter: (token: string) =>
        set((state) => ({
          coverLetterStreaming: state.coverLetterStreaming + token,
        })),

      finalizeCoverLetter: () =>
        set((state) => ({
          coverLetter: state.coverLetterStreaming,
          coverLetterStreaming: '',
        })),

      setCoverLetter: (text: string) => set({ coverLetter: text }),

      setJobSearchResults: (jobs: JobResult[]) => set({ jobSearchResults: jobs }),
      setIsSearching: (v: boolean) => set({ isSearching: v }),

      setIsLoading: (v: boolean) => set({ isLoading: v }),
      setIsStreaming: (v: boolean) => set({ isStreaming: v }),
      setError: (msg: string | null) => set({ error: msg }),

      reset: () => set(initialState),
    }),
    {
      name: 'resume-tailor-state',
      version: 1,
      storage: createDebouncedStorage(),
      partialize: (state) => ({
        masterResume: state.masterResume,
        jobPosting: state.jobPosting,
        analysisModel: state.analysisModel,
        tailorModel: state.tailorModel,
        stage: state.stage,
        keywordResult: state.keywordResult,
        tailoredResume: state.tailoredResume,
        coverLetter: state.coverLetter,
      }),
    }
  )
);
