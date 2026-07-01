// Google Maps Scraper (via SerpApi)
// Perfectly compatible with Vercel Serverless (completes in ~2s)

export async function scrapeGoogleMaps(location, sector) {
  const query = `${sector} in ${location}`;
  console.log(`[scraper] Fetching Google Local data via SerpApi for: "${query}"`);
  
  const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;
  if (!SERPAPI_API_KEY) {
    console.error('[scraper] SERPAPI_API_KEY is missing!');
    throw new Error("SERPAPI_API_KEY is not configured in .env.local");
  }

  const url = `https://serpapi.com/search.json?engine=google_local&q=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&api_key=${SERPAPI_API_KEY}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`SerpApi returned status ${res.status}`);
    }
    
    const data = await res.json();
    
    const businesses = (data.local_results || []).map(result => ({
      name: result.title || "Unknown Business",
      rating: result.rating || null,
      reviews: result.reviews || 0,
      category: result.type || sector,
      address: result.address || location,
      url: result.website || result.links?.website || null,
      source: "Google Maps"
    }));
    
    // Sort by reviews descending to get the most prominent competitors
    businesses.sort((a, b) => b.reviews - a.reviews);
    
    // Return top 15 competitors
    const topCompetitors = businesses.slice(0, 15);
    console.log(`[scraper] Found ${topCompetitors.length} businesses for ${sector}`);
    
    return topCompetitors;
  } catch (error) {
    console.error(`[scraper] SerpApi fetch failed:`, error);
    throw new Error(`Failed to fetch Google Maps data: ${error.message}`);
  }
}
