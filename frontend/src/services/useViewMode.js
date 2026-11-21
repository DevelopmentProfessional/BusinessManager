import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BUTTON_TEXT_SIZES } from "../constants/buttonTextSize";

const useViewMode = create(
  persist(
    (set, get) => ({
      isTrainingMode: true,
      buttonTextSize: "medium",
      toggleViewMode: () => {
        const { isTrainingMode } = get();
        set({ isTrainingMode: !isTrainingMode });
      },
      setTrainingMode: (bool) => {
        set({ isTrainingMode: bool });
      },
      footerAlign: "left",
      setFooterAlign: (align) => set({ footerAlign: align }),
      cycleButtonTextSize: () => {
        const { buttonTextSize } = get();
        const index = BUTTON_TEXT_SIZES.indexOf(buttonTextSize);
        const nextIndex = index >= 0 ? (index + 1) % BUTTON_TEXT_SIZES.length : 1;
        set({ buttonTextSize: BUTTON_TEXT_SIZES[nextIndex] });
      },
      setButtonTextSize: (size) => {
        if (BUTTON_TEXT_SIZES.includes(size)) set({ buttonTextSize: size });
      },
    }),
    {
      name: "view-mode-storage",
      storage: localStorage,
    }
  )
);

export default useViewMode;
