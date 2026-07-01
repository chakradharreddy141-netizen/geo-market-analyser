// POST /api/analyze-sector — Single sector analysis endpoint
import { scrapeGoogleMaps } from '@/lib/scraper';
import { runDeepResearch } from '@/lib/research';
import { analyzeWithGemini } from '@/lib/analyzer';
import { SECTORS } from '@/lib/sectors';

export const maxDuration = 10; // Enforce Vercel hobby limit to prevent hanging

export async function POST(request) {
  try {
    const { location, sector } = await request.json();
    
    if (!location || !sector) {
      return Response.json({ error: "Missing location or sector" }, { status: 400 });
    }

    // Step 1: Scrape Google Maps via SerpApi (Takes ~1-2s)
    let businesses = [];
    try {
      businesses = await scrapeGoogleMaps(location, sector);
    } catch (scrapeErr) {
      console.warn(`[analyze-sector] Scraper failed for ${sector}, proceeding with empty list. Error:`, scrapeErr);
      // We don't fail the whole request, we let research and Gemini do their best
    }

    // Step 2: Deep Research via Tavily (Takes ~1-2s)
    let researchData = null;
    try {
      researchData = await runDeepResearch(location, sector, businesses);
    } catch (researchErr) {
      console.warn(`[analyze-sector] Research failed for ${sector}. Error:`, researchErr);
    }

    // Step 3: Synthesis & SWOT via Gemini (Takes ~3-4s)
    let analysis = null;
    try {
      analysis = await analyzeWithGemini(location, sector, businesses, researchData);
    } catch (geminiErr) {
      console.error(`[analyze-sector] Gemini analysis failed for ${sector}. Error:`, geminiErr);
      return Response.json({ error: "AI Analysis failed for this sector." }, { status: 500 });
    }

    // Return the completed sector payload
    return Response.json({
      sectorId: sector,
      sectorName: SECTORS.find(s => s.id === sector)?.name || sector,
      businesses,
      analysis
    });

  } catch (err) {
    console.error('[analyze-sector] Unhandled error:', err);
    return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
