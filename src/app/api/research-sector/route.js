// POST /api/research-sector — Step 2: Deep research via Tavily API
import { runDeepResearch } from '@/lib/research';

export async function POST(request) {
  try {
    const { location, sector, businesses } = await request.json();
    if (!location || !sector) {
      return Response.json({ error: "Missing location or sector" }, { status: 400 });
    }

    console.log(`[research-sector] Researching ${sector} in ${location}`);
    const researchData = await runDeepResearch(location, sector, businesses || []);
    return Response.json({ researchData });
  } catch (err) {
    console.error('[research-sector] Error:', err);
    return Response.json({ error: err.message || "Failed to perform deep research." }, { status: 500 });
  }
}
