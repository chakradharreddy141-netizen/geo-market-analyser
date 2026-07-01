// POST /api/scrape-sector — Step 1: Scrape Google Maps via SerpApi
import { scrapeGoogleMaps } from '@/lib/scraper';

export async function POST(request) {
  try {
    const { location, sector } = await request.json();
    if (!location || !sector) {
      return Response.json({ error: "Missing location or sector" }, { status: 400 });
    }

    console.log(`[scrape-sector] Scraping for ${sector} in ${location}`);
    const businesses = await scrapeGoogleMaps(location, sector);
    return Response.json({ businesses });
  } catch (err) {
    console.error('[scrape-sector] Error:', err);
    return Response.json({ error: err.message || "Failed to scrape Google Maps." }, { status: 500 });
  }
}
