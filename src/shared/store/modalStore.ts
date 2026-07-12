import { create } from "zustand";

type ModalPayload = unknown;

interface ModalState {
  modals: string[];
  modalProps: Record<string, ModalPayload>;
  openModal: (modalId: string, prop?: ModalPayload) => void;
  closeModal: (modalId: string) => void;
}

export const useModalStore = create<ModalState>((set) => ({
  modals: [],
  modalProps: {},
  openModal: (modalId, prop) =>
    set((state) => ({
      modals: state.modals.includes(modalId) ? state.modals : [...state.modals, modalId],
      modalProps: { ...state.modalProps, [modalId]: prop },
    })),
  closeModal: (modalId) =>
    set((state) => ({
      modals: state.modals.filter((id) => id !== modalId),
      modalProps: Object.fromEntries(Object.entries(state.modalProps).filter(([id]) => id !== modalId)),
    })),
}));
