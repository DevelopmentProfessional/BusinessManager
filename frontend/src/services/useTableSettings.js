import { useMemo } from "react";
import { create } from "zustand";
import useStore from "./useStore";

export const DEFAULT_PAGE_SETTINGS = {
  inventory: { showPrice: true, showCost: true, showCategory: true, showType: true, showStock: true, textSize: "medium" },
  clients: { showEmail: true, showSubs: true, showNotify: true, textSize: "medium" },
  employees: { showRole: true, showDepartment: true, showChat: true, textSize: "medium" },
  documents: { showCategory: true, showTags: true, showType: true, showActions: true, textSize: "medium" },
  services: { showCategory: true, showPrice: true, showDuration: true, textSize: "medium" },
  reports: { textSize: "medium" },
};

export const TABLE_TEXT_SIZES = [
  { id: "tiny", label: "Tiny", fontSize: "0.68rem" },
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
    if (!user?.id) return;
    try {
      const local = localStorage.getItem(`table_settings_${user.id}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && typeof parsed === "object") {
          set({ settings: { ...DEFAULT_PAGE_SETTINGS, ...parsed } });
        }
      }
    } catch {}
  },

  savePageSettings: (page, patch) => {
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

export function usePageTableSettings(page) {
  const pageSetting = useTableSettings((state) => state.settings[page]);
  const savePageSettings = useTableSettings((state) => state.savePageSettings);
  const settings = useMemo(
    () => ({ ...(DEFAULT_PAGE_SETTINGS[page] || {}), ...(pageSetting || {}) }),
    [page, pageSetting]
  );
  return { settings, savePageSettings };
}

export default useTableSettings;
