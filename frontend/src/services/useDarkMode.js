import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const applyTheme = (isDark) => {
  const theme = isDark ? 'dark' : 'light';
  document.body.setAttribute('data-bs-theme', theme);
  document.documentElement.setAttribute('data-bs-theme', theme);
  document.documentElement.classList.toggle('dark', isDark);
};

const useDarkMode = create(
  persist(
    (set, get) => ({
      isDarkMode: false,
      toggleDarkMode: () => {
        const { isDarkMode } = get();
        const newMode = !isDarkMode;
        set({ isDarkMode: newMode });

        applyTheme(newMode);
      },
      setDarkMode: (isDark) => {
        set({ isDarkMode: isDark });

        applyTheme(isDark);
      },
      initializeDarkMode: () => {
        const { isDarkMode } = get();

        applyTheme(isDarkMode);
        
        // Force a re-render of the calendar by triggering a resize event
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
