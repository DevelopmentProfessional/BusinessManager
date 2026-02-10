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
        
        // Update body data attribute for Bootstrap dark mode
        if (newMode) {
          document.body.setAttribute('data-bs-theme', 'dark');
        } else {
          document.body.setAttribute('data-bs-theme', 'light');
        }
      },
      setDarkMode: (isDark) => {
        set({ isDarkMode: isDark });
        
        // Update body data attribute for Bootstrap dark mode
        if (isDark) {
          document.body.setAttribute('data-bs-theme', 'dark');
        } else {
          document.body.setAttribute('data-bs-theme', 'light');
        }
      },
      initializeDarkMode: () => {
        const { isDarkMode } = get();
        
        // Set initial theme based on stored preference
        if (isDarkMode) {
          document.body.setAttribute('data-bs-theme', 'dark');
        } else {
          document.body.setAttribute('data-bs-theme', 'light');
        }
        
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
