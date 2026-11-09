import { create } from "zustand";
import { profileAPI } from "./api";
import useStore from "./useStore";

export const DEFAULT_PAGE_SETTINGS = {
  inventory: { showPrice: true, showCost: true, textSize: "medium" },
  clients: { showEmail: true, textSize: "medium" },
  employees: { showRole: true, textSize: "medium" },
  documents: { showCategory: true, textSize: "medium" },
  services: { showCategory: true, textSize: "medium" },
};

export const TABLE_TEXT_SIZES = [
  { id: "small", label: "Small", fontSize: "0.78rem" },
  { id: "medium", label: "Medium", fontSize: "0.875rem" },
  { id: "large", label: "Large", fontSize: "1rem" },
];

export function getTextSizeStyle(textSize) {
  const match = TABLE_TEXT_SIZES.find((s) => s.id === textSize);
  return { fontSize: match ? match.fontSize : "0.875rem" };
}

function getInitialSettings() {
  try {
    const rawUser = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed?.table_settings) {
        const settings = typeof parsed.table_settings === "string" ? JSON.parse(parsed.table_settings) : parsed.table_settings;
        return { ...DEFAULT_PAGE_SETTINGS, ...settings };
      }
      const local = localStorage.getItem(`table_settings_${parsed.id}`);
      if (local) {
        return { ...DEFAULT_PAGE_SETTINGS, ...JSON.parse(local) };
      }
    }
    const guest = localStorage.getItem("table_settings_guest");
    if (guest) {
      return { ...DEFAULT_PAGE_SETTINGS, ...JSON.parse(guest) };
    }
  } catch {}
  return DEFAULT_PAGE_SETTINGS;
}

const useTableSettings = create((set, get) => ({
  settings: getInitialSettings(),

  loadFromUser: (user) => {
    if (!user) return;
    try {
      let parsed = null;
      if (user.table_settings) {
        parsed = typeof user.table_settings === "string" ? JSON.parse(user.table_settings) : user.table_settings;
      } else if (user.id) {
        const local = localStorage.getItem(`table_settings_${user.id}`);
        if (local) parsed = JSON.parse(local);
      }
      if (parsed && typeof parsed === "object") {
        set({ settings: { ...DEFAULT_PAGE_SETTINGS, ...parsed } });
      }
    } catch {}
  },

  getPageSettings: (page) => {
    const all = get().settings;
    return { ...(DEFAULT_PAGE_SETTINGS[page] || {}), ...(all[page] || {}) };
  },

  setPageSettings: (page, patch) => {
    const all = get().settings;
    const current = all[page] || DEFAULT_PAGE_SETTINGS[page] || {};
    const updated = { ...all, [page]: { ...current, ...patch } };
    set({ settings: updated });
  },

  savePageSettings: async (page, patch) => {
    const all = get().settings;
    const current = all[page] || DEFAULT_PAGE_SETTINGS[page] || {};
    const updatedPage = { ...current, ...patch };
    const updatedAll = { ...all, [page]: updatedPage };
    set({ settings: updatedAll });

    const user = useStore.getState().user;
    const storageKey = user?.id ? `table_settings_${user.id}` : "table_settings_guest";
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedAll));
    } catch {}
  },
}));

export default useTableSettings;
