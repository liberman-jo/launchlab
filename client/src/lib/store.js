import { create } from "zustand";
import { persist } from "zustand/middleware";

const useStore = create(
  persist(
    (set, get) => ({
      // ── AUTH ──────────────────────────────────────────────────────────────────
      token:    null,
      user:     null,
      setAuth:  (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null, currentBusinessId: null }),

      // ── NAVIGATION ────────────────────────────────────────────────────────────
      currentBusinessId: null,
      setCurrentBusiness: (id) => set({ currentBusinessId: id }),

      // ── DISCOVERY ─────────────────────────────────────────────────────────────
      intake: {
        location: "", hours: 15, budget: 2000,
        skills: [], assets: [], risk: "medium",
        incomeGoal: "", ownIdea: "",
      },
      setIntake: (updates) => set(s => ({ intake: { ...s.intake, ...updates } })),
      resetIntake: () => set({ intake: { location: "", hours: 15, budget: 2000, skills: [], assets: [], risk: "medium", incomeGoal: "", ownIdea: "" } }),

      // ── IDEAS ─────────────────────────────────────────────────────────────────
      ideas:       [],
      selectedIdea: null,
      setIdeas:      (ideas) => set({ ideas }),
      setSelectedIdea: (idea) => set({ selectedIdea: idea }),

      // ── BUSINESSES (cached from server) ───────────────────────────────────────
      businesses: [],
      setBusinesses: (businesses) => set({ businesses }),
      updateBusiness: (id, updates) => set(s => ({
        businesses: s.businesses.map(b => b.id === id ? { ...b, ...updates } : b),
      })),
      addBusiness: (b) => set(s => ({ businesses: [b, ...s.businesses] })),

      // ── TASKS (local state, synced with server) ────────────────────────────────
      tasks: {},  // { [businessId]: Task[] }
      setTasks: (businessId, tasks) => set(s => ({ tasks: { ...s.tasks, [businessId]: tasks } })),
      updateTask: (businessId, taskId, updates) => set(s => ({
        tasks: {
          ...s.tasks,
          [businessId]: (s.tasks[businessId] || []).map(t => t.id === taskId ? { ...t, ...updates } : t),
        },
      })),
      addTask: (businessId, task) => set(s => ({
        tasks: { ...s.tasks, [businessId]: [...(s.tasks[businessId] || []), task] },
      })),
      removeTask: (businessId, taskId) => set(s => ({
        tasks: { ...s.tasks, [businessId]: (s.tasks[businessId] || []).filter(t => t.id !== taskId) },
      })),

      // ── HUB MODES (per business) ───────────────────────────────────────────────
      hubModes: {},  // { [businessId]: { discovery, creation, marketing, management } }
      setHubMode: (businessId, stage, mode) => set(s => ({
        hubModes: {
          ...s.hubModes,
          [businessId]: { ...(s.hubModes[businessId] || {}), [stage]: mode },
        },
      })),
    }),
    {
      name: "launchlab-store",
      partialize: (s) => ({ token: s.token, user: s.user, intake: s.intake, currentBusinessId: s.currentBusinessId }),
    }
  )
);

export default useStore;
