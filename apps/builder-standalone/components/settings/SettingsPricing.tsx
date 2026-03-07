"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight,
  Loader2, Save, Eye, EyeOff, Star, StarOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inputCls, cardCls } from "@/components/settings/settingsStyles";

/* ─── Types ─── */

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingPackage {
  id?: string;
  sort_order: number;
  name: string;
  tagline: string;
  price_min: number;
  price_max: number;
  price_label: string;
  features: PricingFeature[];
  button_label: string;
  color_primary: string;
  color_bg: string;
  icon_svg: string;
  is_featured: boolean;
  is_active: boolean;
  revision_rounds: number;
}

interface TrustItem {
  id?: string;
  sort_order: number;
  label: string;
  icon_svg: string;
  color: string;
  is_active: boolean;
}

/* ─── Defaults for new items ─── */

const NEW_PACKAGE: PricingPackage = {
  sort_order: 99,
  name: "New Package",
  tagline: "",
  price_min: 0,
  price_max: 0,
  price_label: "One-time · 50% deposit",
  features: [{ text: "Feature 1", included: true }],
  button_label: "Select",
  color_primary: "#8B5CF6",
  color_bg: "#8B5CF615",
  icon_svg: "",
  is_featured: false,
  is_active: true,
  revision_rounds: 1,
};

const NEW_TRUST: TrustItem = {
  sort_order: 99,
  label: "New Item",
  icon_svg: "✦",
  color: "#FF6700",
  is_active: true,
};

/* ─── Shared label class ─── */
const LBL = "text-xs font-bold text-white uppercase tracking-wide block mb-1";

/* ─── Component ─── */

export function SettingsPricing() {
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [trustItems, setTrustItems] = useState<TrustItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [expandedPkg, setExpandedPkg] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "pkg" | "trust"; idx: number } | null>(null);

  // Load from Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pricing", { method: "POST" });
      const data = await res.json();
      if (data.packages?.length > 0) {
        setPackages(data.packages);
      }
      if (data.trustItems?.length > 0) {
        setTrustItems(data.trustItems);
      }
    } catch {
      setStatus({ type: "error", msg: "Failed to load from Supabase" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const edit = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, fn: (prev: T[]) => T[]) => {
    setter(fn);
    setDirty(true);
    setStatus(null);
  }, []);

  const updatePkg = useCallback((idx: number, field: keyof PricingPackage, value: unknown) => {
    edit(setPackages, (prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, [edit]);

  const updateTrust = useCallback((idx: number, field: keyof TrustItem, value: unknown) => {
    edit(setTrustItems, (prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, [edit]);

  const updateFeature = useCallback((pkgIdx: number, featIdx: number, field: keyof PricingFeature, value: unknown) => {
    edit(setPackages, (prev) => {
      const next = [...prev];
      const feats = [...next[pkgIdx].features];
      feats[featIdx] = { ...feats[featIdx], [field]: value };
      next[pkgIdx] = { ...next[pkgIdx], features: feats };
      return next;
    });
  }, [edit]);

  const addFeature = useCallback((pkgIdx: number) => {
    edit(setPackages, (prev) => {
      const next = [...prev];
      next[pkgIdx] = { ...next[pkgIdx], features: [...next[pkgIdx].features, { text: "", included: true }] };
      return next;
    });
  }, [edit]);

  const removeFeature = useCallback((pkgIdx: number, featIdx: number) => {
    edit(setPackages, (prev) => {
      const next = [...prev];
      const feats = next[pkgIdx].features.filter((_, i) => i !== featIdx);
      next[pkgIdx] = { ...next[pkgIdx], features: feats };
      return next;
    });
  }, [edit]);

  const saveAll = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      const orderedPkgs = packages.map((p, i) => ({ ...p, sort_order: i }));
      const orderedTrust = trustItems.map((t, i) => ({ ...t, sort_order: i }));

      const res = await fetch("/api/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packages: orderedPkgs, trustItems: orderedTrust }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setDirty(false);
      setStatus({ type: "success", msg: "Saved to Supabase" });
      await loadData();
    } catch (err: unknown) {
      setStatus({ type: "error", msg: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }, [packages, trustItems, loadData]);

  const handleDelete = useCallback(async (type: "pkg" | "trust", idx: number) => {
    const item = type === "pkg" ? packages[idx] : trustItems[idx];
    if (item?.id) {
      const table = type === "pkg" ? "pricing_packages" : "pricing_trust_items";
      try {
        await fetch(`/api/pricing?table=${table}&id=${item.id}`, { method: "DELETE" });
      } catch { /* continue */ }
    }
    if (type === "pkg") {
      edit(setPackages, (prev) => prev.filter((_, i) => i !== idx));
    } else {
      edit(setTrustItems, (prev) => prev.filter((_, i) => i !== idx));
    }
    setDeleteConfirm(null);
  }, [packages, trustItems, edit]);

  const movePkg = useCallback((idx: number, dir: -1 | 1) => {
    edit(setPackages, (prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, [edit]);

  const moveTrust = useCallback((idx: number, dir: -1 | 1) => {
    edit(setTrustItems, (prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, [edit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3 text-white">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-base font-semibold">Loading pricing data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Package & Pricing Admin</h2>
          <p className="text-sm font-semibold text-zinc-200 mt-1">
            Edit packages and trust bar items. Changes update the /kickoff page live.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <span className={`text-sm font-bold ${status.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {status.msg}
            </span>
          )}
          <Button
            size="sm"
            onClick={saveAll}
            disabled={saving || !dirty}
            className={`gap-1.5 text-sm font-bold ${dirty ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-zinc-700 text-zinc-300"}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All
          </Button>
        </div>
      </div>

      {/* ─── Packages ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Packages ({packages.length})</h3>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-sm font-bold border-zinc-600 text-white hover:bg-zinc-700"
            onClick={() => {
              edit(setPackages, (prev) => [...prev, { ...NEW_PACKAGE, sort_order: prev.length }]);
              setExpandedPkg(packages.length);
            }}
          >
            <Plus className="w-4 h-4" /> Add Package
          </Button>
        </div>

        {packages.map((pkg, idx) => {
          const isExpanded = expandedPkg === idx;
          return (
            <div key={pkg.id || `new-${idx}`} className={cardCls + " relative"}>
              {/* Collapsed header */}
              <div
                className="flex items-center gap-3 cursor-pointer select-none"
                onClick={() => setExpandedPkg(isExpanded ? null : idx)}
              >
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: pkg.color_primary }} />

                <div className="flex-1 min-w-0">
                  <span className="text-xl font-bold text-white">{pkg.name || "Untitled"}</span>
                  <span className="text-base font-bold text-zinc-200 ml-3">
                    ${pkg.price_min.toLocaleString()}&ndash;${pkg.price_max.toLocaleString()}
                  </span>
                </div>

                {pkg.is_featured && (
                  <span className="text-xs font-bold text-amber-400 border border-amber-400/50 rounded px-2 py-1">FEATURED</span>
                )}
                {!pkg.is_active && (
                  <span className="text-xs font-bold text-red-300 border border-red-400/50 rounded px-2 py-1">HIDDEN</span>
                )}

                <button onClick={(e) => { e.stopPropagation(); movePkg(idx, -1); }} disabled={idx === 0}
                  className="text-white hover:text-indigo-400 disabled:opacity-20 text-sm font-bold px-1">&#9650;</button>
                <button onClick={(e) => { e.stopPropagation(); movePkg(idx, 1); }} disabled={idx === packages.length - 1}
                  className="text-white hover:text-indigo-400 disabled:opacity-20 text-sm font-bold px-1">&#9660;</button>

                {isExpanded ? <ChevronDown className="w-5 h-5 text-white" /> : <ChevronRight className="w-5 h-5 text-white" />}
              </div>

              {/* Expanded editor */}
              {isExpanded && (
                <div className="mt-4 space-y-5 border-t border-zinc-600 pt-4">
                  {/* Row 1: Name + Tagline */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LBL}>Name</label>
                      <Input className={inputCls} value={pkg.name} onChange={(e) => updatePkg(idx, "name", e.target.value)} />
                    </div>
                    <div>
                      <label className={LBL}>Tagline</label>
                      <Input className={inputCls} value={pkg.tagline} onChange={(e) => updatePkg(idx, "tagline", e.target.value)} />
                    </div>
                  </div>

                  {/* Row 2: Price min/max/label + button label */}
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className={LBL}>Price Min ($)</label>
                      <Input className={inputCls} type="number" value={pkg.price_min}
                        onChange={(e) => updatePkg(idx, "price_min", parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className={LBL}>Price Max ($)</label>
                      <Input className={inputCls} type="number" value={pkg.price_max}
                        onChange={(e) => updatePkg(idx, "price_max", parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className={LBL}>Price Label</label>
                      <Input className={inputCls} value={pkg.price_label} onChange={(e) => updatePkg(idx, "price_label", e.target.value)} />
                    </div>
                    <div>
                      <label className={LBL}>Button Label</label>
                      <Input className={inputCls} value={pkg.button_label} onChange={(e) => updatePkg(idx, "button_label", e.target.value)} />
                    </div>
                  </div>

                  {/* Row 3: Colors + Revision rounds */}
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className={LBL}>Primary Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={pkg.color_primary}
                          onChange={(e) => updatePkg(idx, "color_primary", e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-zinc-600 bg-transparent" />
                        <Input className={inputCls + " flex-1"} value={pkg.color_primary}
                          onChange={(e) => updatePkg(idx, "color_primary", e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className={LBL}>Background Color</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={pkg.color_bg.replace(/[0-9a-f]{2}$/i, "")}
                          onChange={(e) => updatePkg(idx, "color_bg", e.target.value + "15")}
                          className="w-8 h-8 rounded cursor-pointer border border-zinc-600 bg-transparent" />
                        <Input className={inputCls + " flex-1"} value={pkg.color_bg}
                          onChange={(e) => updatePkg(idx, "color_bg", e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className={LBL}>Revision Rounds</label>
                      <Input className={inputCls} type="number" min={0} max={10} value={pkg.revision_rounds}
                        onChange={(e) => updatePkg(idx, "revision_rounds", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="flex items-end gap-3 pb-1">
                      <button
                        onClick={() => updatePkg(idx, "is_featured", !pkg.is_featured)}
                        className={`flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded ${pkg.is_featured ? "text-amber-400 bg-amber-400/15" : "text-zinc-200 hover:text-white bg-zinc-700"}`}
                      >
                        {pkg.is_featured ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                        Featured
                      </button>
                      <button
                        onClick={() => updatePkg(idx, "is_active", !pkg.is_active)}
                        className={`flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded ${pkg.is_active ? "text-emerald-400 bg-emerald-400/15" : "text-zinc-200 hover:text-white bg-zinc-700"}`}
                      >
                        {pkg.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        Active
                      </button>
                    </div>
                  </div>

                  {/* Icon SVG */}
                  <div>
                    <label className={LBL}>Icon SVG</label>
                    <div className="flex gap-3">
                      <textarea
                        value={pkg.icon_svg}
                        onChange={(e) => updatePkg(idx, "icon_svg", e.target.value)}
                        rows={3}
                        className="flex-1 rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none resize-none"
                        placeholder='<svg viewBox="0 0 48 48" ...>...</svg>'
                      />
                      {pkg.icon_svg && (
                        <div
                          className="w-16 h-16 rounded-lg border border-zinc-600 flex items-center justify-center flex-shrink-0"
                          style={{ color: pkg.color_primary }}
                          dangerouslySetInnerHTML={{
                            __html: pkg.icon_svg.replace("<svg", '<svg width="32" height="32"'),
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={LBL + " mb-0"}>
                        Features ({pkg.features.length})
                      </label>
                      <button
                        onClick={() => addFeature(idx)}
                        className="text-sm text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add Feature
                      </button>
                    </div>
                    <div className="space-y-2">
                      {pkg.features.map((feat, fi) => (
                        <div key={fi} className="flex items-center gap-2">
                          <button
                            onClick={() => updateFeature(idx, fi, "included", !feat.included)}
                            className={`w-7 h-7 rounded flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                              feat.included
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-zinc-700 text-zinc-300"
                            }`}
                          >
                            {feat.included ? "\u2713" : "\u2715"}
                          </button>
                          <Input
                            className={inputCls + " flex-1"}
                            value={feat.text}
                            onChange={(e) => updateFeature(idx, fi, "text", e.target.value)}
                            placeholder="Feature description"
                          />
                          <button
                            onClick={() => removeFeature(idx, fi)}
                            className="text-zinc-300 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delete package */}
                  <div className="flex justify-end pt-3 border-t border-zinc-600">
                    {deleteConfirm?.type === "pkg" && deleteConfirm.idx === idx ? (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-red-400">Delete &ldquo;{pkg.name}&rdquo;?</span>
                        <Button size="sm" variant="destructive" className="text-sm font-bold h-8" onClick={() => handleDelete("pkg", idx)}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="outline" className="text-sm font-bold h-8 border-zinc-600 text-white" onClick={() => setDeleteConfirm(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm({ type: "pkg", idx })}
                        className="text-sm font-semibold text-zinc-300 hover:text-red-400 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Package
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {packages.length === 0 && (
          <div className="text-center text-base font-semibold text-zinc-200 py-8">
            No packages. Click &ldquo;Add Package&rdquo; to create one, or run the migration SQL to seed defaults.
          </div>
        )}
      </div>

      {/* ─── Trust Bar ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Trust Bar Items ({trustItems.length})</h3>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-sm font-bold border-zinc-600 text-white hover:bg-zinc-700"
            onClick={() => edit(setTrustItems, (prev) => [...prev, { ...NEW_TRUST, sort_order: prev.length }])}
          >
            <Plus className="w-4 h-4" /> Add Item
          </Button>
        </div>

        <div className="space-y-2">
          {trustItems.map((item, idx) => (
            <div key={item.id || `trust-${idx}`} className={cardCls + " flex items-center gap-3"}>
              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveTrust(idx, -1)} disabled={idx === 0}
                  className="text-white hover:text-indigo-400 disabled:opacity-20 text-sm font-bold">&#9650;</button>
                <button onClick={() => moveTrust(idx, 1)} disabled={idx === trustItems.length - 1}
                  className="text-white hover:text-indigo-400 disabled:opacity-20 text-sm font-bold">&#9660;</button>
              </div>

              {/* Color */}
              <input type="color" value={item.color}
                onChange={(e) => updateTrust(idx, "color", e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-zinc-600 bg-transparent flex-shrink-0" />

              {/* Icon */}
              <Input className={inputCls + " w-20 text-center"} value={item.icon_svg}
                onChange={(e) => updateTrust(idx, "icon_svg", e.target.value)} />

              {/* Label */}
              <Input className={inputCls + " flex-1"} value={item.label}
                onChange={(e) => updateTrust(idx, "label", e.target.value)} placeholder="Trust bar text" />

              {/* Active toggle */}
              <button
                onClick={() => updateTrust(idx, "is_active", !item.is_active)}
                className={`text-sm font-bold px-3 py-1.5 rounded ${item.is_active ? "text-emerald-400 bg-emerald-400/15" : "text-zinc-300 bg-zinc-700"}`}
              >
                {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>

              {/* Delete */}
              {deleteConfirm?.type === "trust" && deleteConfirm.idx === idx ? (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="destructive" className="text-xs font-bold h-7 px-2" onClick={() => handleDelete("trust", idx)}>Yes</Button>
                  <Button size="sm" variant="outline" className="text-xs font-bold h-7 px-2 border-zinc-600 text-white" onClick={() => setDeleteConfirm(null)}>No</Button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm({ type: "trust", idx })} className="text-zinc-300 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {trustItems.length === 0 && (
            <div className="text-center text-base font-semibold text-zinc-200 py-6">
              No trust bar items. Click &ldquo;Add Item&rdquo; to create one.
            </div>
          )}
        </div>
      </div>

      {/* ─── Migration Info ─── */}
      <div className="rounded-lg border border-zinc-600 bg-zinc-800 p-4">
        <p className="text-sm font-semibold text-white leading-relaxed">
          <strong className="text-indigo-400">First-time setup:</strong> Run{" "}
          <code className="text-indigo-300 bg-zinc-700 px-1.5 py-0.5 rounded text-sm font-bold">supabase/migration_pricing.sql</code>{" "}
          in the Supabase SQL Editor to create tables and seed default data. The /kickoff page falls back to{" "}
          <code className="text-indigo-300 bg-zinc-700 px-1.5 py-0.5 rounded text-sm font-bold">lib/pricing-config.ts</code>{" "}
          if Supabase has no rows.
        </p>
      </div>
    </div>
  );
}
