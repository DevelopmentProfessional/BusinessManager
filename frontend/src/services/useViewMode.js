import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useViewMode = create(
  persist(
    (set, get) => ({
      isTrainingMode: false,
      toggleViewMode: () => {
        const { isTrainingMode } = get();
        set({ isTrainingMode: !isTrainingMode });
      },
      setTrainingMode: (bool) => {
        set({ isTrainingMode: bool });
      },
    }),
    {
      name: 'view-mode-storage',
      storage: localStorage,
    }
  )
);

export default useViewMode;
