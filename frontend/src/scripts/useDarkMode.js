import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useDarkMode = create(
  persist(
    (set, get) => ({
      isDarkMode: false,
      toggleDarkMode: () => {
        const { isDarkMode } = get();
        const newMode = !isDarkMode;
        set({ isDarkMode: newMode });
        if (newMode) {
          document.body.setAttribute('data-bs-theme', 'dark');
        } else {
          document.body.setAttribute('data-bs-theme', 'light');
        }
      },
      setDarkMode: (isDark) => {
        set({ isDarkMode: isDark });
        if (isDark) {
          document.body.setAttribute('data-bs-theme', 'dark');
        } else {
          document.body.setAttribute('data-bs-theme', 'light');
        }
      },
      initializeDarkMode: () => {
        const { isDarkMode } = get();
        if (isDarkMode) {
          document.body.setAttribute('data-bs-theme', 'dark');
        } else {
          document.body.setAttribute('data-bs-theme', 'light');
        }
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }
    }),
    {
      name: 'dark-mode-storage',
      storage: localStorage,
    }
  )
);

export default useDarkMode;
