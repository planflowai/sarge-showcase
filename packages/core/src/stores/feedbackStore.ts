import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "@/lib/utils/debouncedStorage";

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface FeedbackItem {
  id: string;
  customerName: string;
  email: string;
  rating: number;
  sentiment: Sentiment;
  comment: string;
  date: string;
  tags: string[];
  resolved: boolean;
}

interface FeedbackStore {
  feedbacks: FeedbackItem[];
  addFeedback: (feedback: Omit<FeedbackItem, 'id'>) => void;
  updateFeedback: (id: string, updates: Partial<FeedbackItem>) => void;
  deleteFeedback: (id: string) => void;
  toggleResolved: (id: string) => void;
  getStats: () => {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    resolved: number;
    averageRating: number;
  };
}

export const useFeedbackStore = create<FeedbackStore>()(
  persist(
    (set, get) => ({
      feedbacks: [],
      
      addFeedback: (feedback) => {
        const newFeedback: FeedbackItem = {
          ...feedback,
          id: Date.now().toString(),
        };
        set((state) => ({
          feedbacks: [newFeedback, ...state.feedbacks],
        }));
      },
      
      updateFeedback: (id, updates) => {
        set((state) => ({
          feedbacks: state.feedbacks.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },
      
      deleteFeedback: (id) => {
        set((state) => ({
          feedbacks: state.feedbacks.filter((item) => item.id !== id),
        }));
      },
      
      toggleResolved: (id) => {
        set((state) => ({
          feedbacks: state.feedbacks.map((item) =>
            item.id === id ? { ...item, resolved: !item.resolved } : item
          ),
        }));
      },
      
      getStats: () => {
        const { feedbacks } = get();
        const total = feedbacks.length;
        const positive = feedbacks.filter(f => f.sentiment === 'positive').length;
        const neutral = feedbacks.filter(f => f.sentiment === 'neutral').length;
        const negative = feedbacks.filter(f => f.sentiment === 'negative').length;
        const resolved = feedbacks.filter(f => f.resolved).length;
        const averageRating = total > 0 
          ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / total 
          : 0;
        
        return {
          total,
          positive,
          neutral,
          negative,
          resolved,
          averageRating: Number(averageRating.toFixed(1)),
        };
      },
    }),
    {
      name: 'feedback-storage',
    }
  )
);
