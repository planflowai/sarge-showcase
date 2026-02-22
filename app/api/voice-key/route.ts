import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");

  let key = "";
  switch (provider) {
    case "openai":
      key = process.env.OPENAI_API_KEY ?? "";
      break;
    case "google":
      key = process.env.GOOGLE_API_KEY ?? "";
      break;
    case "xai":
      key = process.env.XAI_API_KEY ?? "";
      break;
  }

  if (!key) {
    return NextResponse.json({ error: "No key for provider" }, { status: 400 });
  }

  return NextResponse.json({ key });
}
