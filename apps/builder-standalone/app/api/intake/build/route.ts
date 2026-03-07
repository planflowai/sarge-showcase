import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { intakeToPrompt } from "@sarge/builder/lib/intakeToPrompt";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Build from Intake — assembles the builder prompt from a stored intake record.
 * Called by the "Build from Intake" button in the pipeline UI.
 *
 * POST /api/intake/build
 * Body: { ref_code: string }
 * Returns: { prompt: string, ref_code: string, pages: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const { ref_code } = await req.json();

    if (!ref_code) {
      return NextResponse.json({ error: "Missing ref_code" }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the intake row
    const { data: intake, error: fetchErr } = await supabase
      .from("client_intake")
      .select("*")
      .eq("ref_code", ref_code)
      .single();

    if (fetchErr || !intake) {
      return NextResponse.json({ error: "Intake not found" }, { status: 404 });
    }

    // The form_data column stores the raw intake JSON — may be flat or nested
    const rawFormData = intake.form_data || intake;
    const fd = rawFormData.form_data && typeof rawFormData.form_data === "object"
      ? rawFormData.form_data
      : rawFormData;

    // Assemble prompt via intakeToPrompt (handles unwrapping internally too)
    const prompt = intakeToPrompt(rawFormData);

    if (!prompt || prompt.length < 100) {
      return NextResponse.json(
        { error: "Prompt assembly failed — too short" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      prompt,
      ref_code,
      pages: fd.pages || [],
      prompt_length: prompt.length,
    });
  } catch (err: any) {
    console.error("[intake/build] Error:", err);
    return NextResponse.json(
      { error: err.message || "Build from intake failed" },
      { status: 500 },
    );
  }
}
