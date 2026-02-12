import { create } from 'zustand';
import { sportsApi } from '@/lib/api';
import type { Sport, Event } from '@/types';

interface SportsState {
  sports: Sport[];
  liveEvents: Event[];
  featuredEvents: Event[];
  isLoading: boolean;
  activeSport: string | null;

  loadSports: () => Promise<void>;
  loadLiveEvents: () => Promise<void>;
  loadFeaturedEvents: () => Promise<void>;
  setActiveSport: (slug: string | null) => void;
}

export const useSportsStore = create<SportsState>((set) => ({
  sports: [],
  liveEvents: [],
  featuredEvents: [],
  isLoading: false,
  activeSport: null,

  loadSports: async () => {
    set({ isLoading: true });
    try {
      const { data } = await sportsApi.getSports();
      set({ sports: Array.isArray(data.data) ? data.data : [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  loadLiveEvents: async () => {
    try {
      const { data } = await sportsApi.getLiveEvents();
      set({ liveEvents: Array.isArray(data.data) ? data.data : [] });
    } catch {}
  },

  loadFeaturedEvents: async () => {
    try {
      const { data } = await sportsApi.getFeaturedEvents();
      set({ featuredEvents: Array.isArray(data.data) ? data.data : [] });
    } catch {}
  },

  setActiveSport: (slug) => set({ activeSport: slug }),
}));
