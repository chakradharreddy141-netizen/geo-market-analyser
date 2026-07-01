// POST /api/synthesize-sector — Step 3: Synthesis & SWOT analysis via Gemini API
import { analyzeWithGemini } from '@/lib/analyzer';

export async function POST(request) {
  try {
    const { location, sector, businesses, researchData } = await request.json();
    if (!location || !sector) {
      return Response.json({ error: "Missing location or sector" }, { status: 400 });
    }

    console.log(`[synthesize-sector] Synthesizing SWOT for ${sector} in ${location}`);
    const analysis = await analyzeWithGemini(location, sector, businesses || [], researchData || null);
    
    if (!analysis) {
      throw new Error("Gemini returned empty or invalid analysis");
    }

    return Response.json({ analysis });
  } catch (err) {
    console.error('[synthesize-sector] Error:', err);
    return Response.json({ error: err.message || "Failed to synthesize analysis." }, { status: 500 });
  }
}
