import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { intakeToPrompt, flattenIntake, PAGE_DIFFICULTY, intakeToPagePrompt } from "@sarge/builder/lib/intakeToPrompt";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Build from Intake — assembles the builder prompt from a stored intake record.
 *
 * POST /api/intake/build
 * Body: { ref_code: string, page?: string }
 *
 * Without page: returns full prompt + page manifest with difficulties
 * With page: returns per-page prompt for multi-page pipeline
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ref_code = body.ref_code;
    const targetPage = body.page; // optional — for per-page builds
    const sharedCss = body.shared_css;
    const navSnippet = body.nav_snippet;

    if (!ref_code) {
      return NextResponse.json({ error: "Missing ref_code" }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: intake, error: fetchErr } = await supabase
      .from("client_intake")
      .select("*")
      .eq("ref_code", ref_code)
      .single();

    if (fetchErr || !intake) {
      return NextResponse.json({ error: "Intake not found" }, { status: 404 });
    }

    const rawFormData = intake.form_data || intake;
    const flat = flattenIntake(rawFormData);

    // Per-page prompt mode
    if (targetPage) {
      const pagePrompt = intakeToPagePrompt(rawFormData, targetPage, sharedCss, navSnippet);
      const pageKey = targetPage.toLowerCase().replace(/\s+/g, "-");
      return NextResponse.json({
        prompt: pagePrompt,
        ref_code,
        page: targetPage,
        difficulty: PAGE_DIFFICULTY[pageKey] || "medium",
        prompt_length: pagePrompt.length,
      });
    }

    // Full prompt mode — returns everything needed for multi-page orchestration
    const prompt = intakeToPrompt(rawFormData);

    if (!prompt || prompt.length < 100) {
      return NextResponse.json(
        { error: "Prompt assembly failed — too short" },
        { status: 500 },
      );
    }

    const pages: string[] = Array.isArray(flat.pages) ? flat.pages : ["home"];
    const pageManifest = pages.map((p: string) => {
      const key = p.toLowerCase().replace(/\s+/g, "-");
      return {
        name: p,
        key,
        difficulty: PAGE_DIFFICULTY[key] || "medium",
        filename: key === "home" ? "index.html" : `${key}.html`,
      };
    });

    return NextResponse.json({
      prompt,
      ref_code,
      pages,
      pageManifest,
      flat,
      prompt_length: prompt.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[intake/build] Error:", msg);
    return NextResponse.json(
      { error: msg || "Build from intake failed" },
      { status: 500 },
    );
  }
}
