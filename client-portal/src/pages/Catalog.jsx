/**
 * CATALOG PAGE — Full-page Amazon-style browsing.
 * Same layout as Dashboard but with sidebar filters (price range, rating, etc.)
 * and a list-style detail view on click.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import Layout from "./components/Layout";
import ItemCard from "./components/ItemCard";
import BookingCalendar from "./components/BookingCalendar";
import BookingConfirmation from "./components/BookingConfirmation";
import { catalogAPI, bookingsAPI } from "../services/api";
import useStore from "../store/useStore";

export default function Catalog() {
  const navigate = useNavigate();
  const companyId = useStore((s) => s.companyId);
  const addToast = useStore((s) => s.addToast);
  const addToCart = useStore((s) => s.addToCart);

  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // Booking state
  const [bookingService, setBookingService] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(null);

  function bookingErrorMessage(err) {
    const detail = err?.response?.data?.detail;
    if (typeof detail !== "string" || !detail.trim()) {
      return "Could not book this slot. Please refresh availability and try again.";
    }

    const normalized = detail.toLowerCase();
    if (normalized.includes("no available employees") || normalized.includes("unavailable") || normalized.includes("another time")) {
      return "That slot was just taken. Please choose a different time from the refreshed calendar.";
    }
    return detail;
  }

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [prods, svcs] = await Promise.all([catalogAPI.getProducts({ company_id: companyId }), catalogAPI.getServices({ company_id: companyId })]);
      setProducts(prods);
      setServices(svcs);
    } catch {
      addToast("Failed to load catalog.", "error");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const allCategories = [...new Set([...products.map((p) => p.category).filter(Boolean), ...services.map((s) => s.category).filter(Boolean)])].sort();

  function filterItems(items) {
    return items.filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== "all" && item.category !== category) return false;
      if (minPrice && item.price < parseFloat(minPrice)) return false;
      if (maxPrice && item.price > parseFloat(maxPrice)) return false;
      return true;
    });
  }

  const showProducts = tab === "all" || tab === "products";
  const showServices = tab === "all" || tab === "services";
  const fp = showProducts ? filterItems(products) : [];
  const fs = showServices ? filterItems(services) : [];

  function handleSelect(item, itemType) {
    if (itemType === "service") setBookingService(item);
  }

  async function handleSlotSelected(slot) {
    if (!bookingService) return;
    setBookingLoading(true);
    try {
      await bookingsAPI.create({
        service_id: bookingService.id,
        appointment_date: slot.start,
        booking_mode: slot.booking_mode || "soft",
        notes: "",
      });
      const confirmed = { service: bookingService, slot };
      setBookingService(null);
      setBookingConfirmed(confirmed);
      return true;
    } catch (err) {
      addToast(bookingErrorMessage(err), "error");
      return false;
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Catalog</h1>

      <div className="flex gap-6">
        {/* ── Sidebar Filters ─────────────────────────────────── */}
        <aside className="w-56 flex-shrink-0 space-y-6">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <AdjustmentsHorizontalIcon className="w-4 h-4" />
              Filters
            </h3>

            <div className="space-y-4">
              <div>
                <label className="form-label text-xs">Category</label>
                <select className="form-input text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All</option>
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Price Range</label>
                <div className="flex gap-2">
                  <input className="form-input text-sm" placeholder="Min" type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                  <input className="form-input text-sm" placeholder="Max" type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                </div>
              </div>

              <button
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  setMinPrice("");
                  setMaxPrice("");
                  setTab("all");
                }}
                className="btn-secondary w-full text-xs justify-center"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main Grid ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Search + tabs */}
          <div className="flex gap-3 mb-5">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="form-input pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
              {[
                ["all", "All"],
                ["products", "Products"],
                ["services", "Services"],
              ].map(([v, l]) => (
                <button key={v} onClick={() => setTab(v)} className={`px-4 py-2 transition-colors ${tab === v ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {fs.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Services</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {fs.map((s) => (
                      <ItemCard key={s.id} item={s} itemType="service" onSelect={handleSelect} />
                    ))}
                  </div>
                </section>
              )}
              {fp.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Products</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {fp.map((p) => (
                      <ItemCard key={p.id} item={p} itemType="product" onSelect={handleSelect} />
                    ))}
                  </div>
                </section>
              )}
              {fp.length === 0 && fs.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                  <p className="text-lg font-medium">No items match your filters.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {bookingService && <BookingCalendar service={bookingService} companyId={companyId} onSelect={handleSlotSelected} onClose={() => setBookingService(null)} submitting={bookingLoading} />}

      {bookingConfirmed && (
        <BookingConfirmation
          service={bookingConfirmed.service}
          slot={bookingConfirmed.slot}
          onClose={() => setBookingConfirmed(null)}
          onViewBookings={() => {
            setBookingConfirmed(null);
            navigate("/orders");
          }}
        />
      )}
    </Layout>
  );
}
