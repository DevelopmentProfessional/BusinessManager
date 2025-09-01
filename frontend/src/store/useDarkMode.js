import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useDarkMode = create(
  persist(
    (set, get) => ({
      isDarkMode: false,
      toggleDarkMode: async () => {
        const { isDarkMode } = get();
        const newMode = !isDarkMode;
        set({ isDarkMode: newMode });
        
        // Update body data attribute for Bootstrap dark mode
        if (newMode) {
          document.body.setAttribute('data-bs-theme', 'dark');
        } else {
          document.body.setAttribute('data-bs-theme', 'light');
        }
        
        // Sync with backend
        try {
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');
          if (token) {
            const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
            await fetch(`${API_BASE_URL}/auth/me/dark-mode`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ dark_mode: newMode }),
            });
          }
        } catch (error) {
          console.error('Failed to sync dark mode preference:', error);
        }
      },
      setDarkMode: async (isDark) => {
        set({ isDarkMode: isDark });
        
        // Update body data attribute for Bootstrap dark mode
        if (isDark) {
          document.body.setAttribute('data-bs-theme', 'dark');
        } else {
          document.body.setAttribute('data-bs-theme', 'light');
        }
        
        // Sync with backend
        try {
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');
          if (token) {
            const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
            await fetch(`${API_BASE_URL}/auth/me/dark-mode`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ dark_mode: isDark }),
            });
          }
        } catch (error) {
          console.error('Failed to sync dark mode preference:', error);
        }
      },
      initializeDarkMode: async () => {
        const { isDarkMode } = get();
        
        // Set initial theme based on stored preference
        if (isDarkMode) {
          document.body.setAttribute('data-bs-theme', 'dark');
        } else {
          document.body.setAttribute('data-bs-theme', 'light');
        }
        
        // Try to sync with user's backend preference
        try {
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');
          if (token) {
            const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (response.ok) {
              const userData = await response.json();
              if (userData.dark_mode !== undefined && userData.dark_mode !== isDarkMode) {
                set({ isDarkMode: userData.dark_mode });
                if (userData.dark_mode) {
                  document.body.setAttribute('data-bs-theme', 'dark');
                } else {
                  document.body.setAttribute('data-bs-theme', 'light');
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to sync dark mode preference from backend:', error);
        }
      }
    }),
    {
      name: 'dark-mode-storage',
      storage: localStorage,
    }
  )
);

export default useDarkMode;
