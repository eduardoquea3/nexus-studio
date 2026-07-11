import { create } from "zustand";
import type { ConnectionProfile } from "../types/models";

interface ConnectionState {
  profiles: ConnectionProfile[];
  isModalOpen: boolean;
  editingId: string | null;
  setProfiles: (profiles: ConnectionProfile[]) => void;
  addProfile: (profile: ConnectionProfile) => void;
  removeProfile: (id: string) => void;
  updateProfile: (profile: ConnectionProfile) => void;
  openModal: (editingId?: string) => void;
  closeModal: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  profiles: [],
  isModalOpen: false,
  editingId: null,
  setProfiles: (profiles) => set({ profiles }),
  addProfile: (profile) => set((s) => ({ profiles: [...s.profiles, profile] })),
  removeProfile: (id) => set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),
  updateProfile: (profile) =>
    set((s) => ({ profiles: s.profiles.map((p) => (p.id === profile.id ? profile : p)) })),
  openModal: (editingId) => set({ isModalOpen: true, editingId: editingId ?? null }),
  closeModal: () => set({ isModalOpen: false, editingId: null }),
}));
