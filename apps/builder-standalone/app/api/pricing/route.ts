import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/* ─── GET: Fetch all packages + trust items ─── */

export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ packages: [], trustItems: [], source: "none" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const [pkgRes, trustRes] = await Promise.all([
    supabase
      .from("pricing_packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("pricing_trust_items")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  return NextResponse.json({
    packages: pkgRes.data || [],
    trustItems: trustRes.data || [],
    source: "supabase",
  });
}

/* ─── PUT: Save all packages + trust items (admin) ─── */

export async function PUT(request: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: { packages?: Record<string, unknown>[]; trustItems?: Record<string, unknown>[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = new Date().toISOString();
  const errors: string[] = [];

  // ── Save packages ──
  if (body.packages) {
    for (const pkg of body.packages) {
      const row = {
        sort_order: pkg.sort_order ?? 0,
        name: pkg.name || "Untitled",
        tagline: pkg.tagline || "",
        price_min: pkg.price_min ?? 0,
        price_max: pkg.price_max ?? 0,
        price_label: pkg.price_label || "One-time",
        features: pkg.features || [],
        button_label: pkg.button_label || "Select",
        color_primary: pkg.color_primary || "#8B5CF6",
        color_bg: pkg.color_bg || "#8B5CF615",
        icon_svg: pkg.icon_svg || "",
        is_featured: pkg.is_featured ?? false,
        is_active: pkg.is_active ?? true,
        revision_rounds: pkg.revision_rounds ?? 1,
        updated_at: now,
      };

      if (pkg.id) {
        // Update existing
        const { error } = await supabase
          .from("pricing_packages")
          .update(row)
          .eq("id", pkg.id);
        if (error) errors.push(`Package update ${pkg.id}: ${error.message}`);
      } else {
        // Insert new
        const { error } = await supabase.from("pricing_packages").insert(row);
        if (error) errors.push(`Package insert: ${error.message}`);
      }
    }
  }

  // ── Save trust items ──
  if (body.trustItems) {
    for (const item of body.trustItems) {
      const row = {
        sort_order: item.sort_order ?? 0,
        label: item.label || "Untitled",
        icon_svg: item.icon_svg || "✦",
        color: item.color || "#FF6700",
        is_active: item.is_active ?? true,
        updated_at: now,
      };

      if (item.id) {
        const { error } = await supabase
          .from("pricing_trust_items")
          .update(row)
          .eq("id", item.id);
        if (error) errors.push(`Trust update ${item.id}: ${error.message}`);
      } else {
        const { error } = await supabase.from("pricing_trust_items").insert(row);
        if (error) errors.push(`Trust insert: ${error.message}`);
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/* ─── DELETE: Remove a package or trust item by id ─── */

export async function DELETE(request: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");
  const id = searchParams.get("id");

  if (!id || (table !== "pricing_packages" && table !== "pricing_trust_items")) {
    return NextResponse.json({ error: "Invalid table or id" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/* ─── GET all (including inactive) for admin ─── */

export async function POST(request: NextRequest) {
  // POST with action=admin-list returns ALL rows (including inactive)
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ packages: [], trustItems: [], source: "none" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const [pkgRes, trustRes] = await Promise.all([
    supabase
      .from("pricing_packages")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("pricing_trust_items")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  return NextResponse.json({
    packages: pkgRes.data || [],
    trustItems: trustRes.data || [],
    source: "supabase",
  });
}
