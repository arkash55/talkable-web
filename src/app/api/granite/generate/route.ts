
import { NextRequest, NextResponse } from "next/server";
import { generateRankedCandidates, type GenerateRequest } from "@/services/graniteService";

export const dynamic = "force-dynamic";



export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GenerateRequest>;

    if (!body?.prompt || typeof body.prompt !== "string") {
      return NextResponse.json({ error: "Missing 'prompt' string" }, { status: 400 });
    }

    const result = await generateRankedCandidates({
      prompt: body.prompt,
      context: Array.isArray(body.context) ? body.context : undefined,
      system: typeof body.system === "string" ? body.system : "",
      k: typeof body.k === "number" ? body.k : 6,
      params: body.params,
    });

    console.log(body.system)

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
