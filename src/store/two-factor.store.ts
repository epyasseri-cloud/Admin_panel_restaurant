import { create } from 'zustand';

interface TwoFactorStore {
  isOpen: boolean;
  challengeId: string | null;
  action: string | null;
  onVerify: ((code: string) => Promise<void>) | null;
  openChallenge: (challengeId: string, action: string, onVerify: (code: string) => Promise<void>) => void;
  closeChallenge: () => void;
  reset: () => void;
}

export const useTwoFactorStore = create<TwoFactorStore>((set) => ({
  isOpen: false,
  challengeId: null,
  action: null,
  onVerify: null,
  openChallenge: (challengeId, action, onVerify) =>
    set({ isOpen: true, challengeId, action, onVerify }),
  closeChallenge: () => set({ isOpen: false, challengeId: null, action: null, onVerify: null }),
  reset: () => set({ isOpen: false, challengeId: null, action: null, onVerify: null }),
}));
