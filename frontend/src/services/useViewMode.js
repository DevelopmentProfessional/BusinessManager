import { create } from "zustand";
import { persist } from "zustand/middleware";

const useViewMode = create(
  persist(
    (set, get) => ({
      isTrainingMode: false,
      uiScale: 100,
      toggleViewMode: () => {
        const { isTrainingMode } = get();
        set({ isTrainingMode: !isTrainingMode });
      },
      setTrainingMode: (bool) => {
        set({ isTrainingMode: bool });
      },
      setUiScale: (scale) => {
        const numericScale = Number(scale);
        const safeScale = Number.isFinite(numericScale) ? Math.min(150, Math.max(90, numericScale)) : 100;
        set({ uiScale: safeScale });
      },
      cycleUiScale: () => {
        const zoomLevels = [90, 100, 110, 125, 150];
        const { uiScale } = get();
        const currentIndex = zoomLevels.indexOf(uiScale);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % zoomLevels.length : 1;
        set({ uiScale: zoomLevels[nextIndex] });
      },
      footerAlign: "left",
      setFooterAlign: (align) => set({ footerAlign: align }),
    }),
    {
      name: "view-mode-storage",
      storage: localStorage,
    }
  )
);

export default useViewMode;
