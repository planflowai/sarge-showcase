import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const { ref_code, page, description, priority } = await request.json();

    if (!ref_code || !page || !description) {
      return NextResponse.json(
        { error: "Missing required fields: ref_code, page, description" },
        { status: 400 }
      );
    }

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from("client_revisions").insert({
        ref_code,
        page,
        description,
        priority: priority || "medium",
        status: "new",
      });
      if (error) {
        console.error("[intake/revision] Supabase error:", error.message);
        return NextResponse.json(
          { error: "Failed to save revision" },
          { status: 500 }
        );
      }
    } else {
      console.warn("[intake/revision] Supabase not configured — logging revision");
      console.log("[intake/revision]", { ref_code, page, description, priority });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[intake/revision] Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Submission failed" },
      { status: 500 }
    );
  }
}
