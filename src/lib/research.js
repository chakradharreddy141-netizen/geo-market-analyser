// Tavily Deep Research — Node.js port
// Runs high-level sector queries and top competitor investigations

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

async function searchTavily(query) {
  if (!TAVILY_API_KEY) {
    console.log('[research] Tavily API key not configured. Skipping search.');
    return [];
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 3,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.results || [];
    } else {
      console.log(`[research] Tavily returned status ${response.status} for: "${query}"`);
      return [];
    }
  } catch (err) {
    console.error(`[research] Error calling Tavily:`, err.message);
    return [];
  }
}

/**
 * Run deep research for a single sector
 * @param {string} location - Target location
 * @param {string} sectorName - Sector display name
 * @param {Array} businesses - Scraped business data from Google Maps
 * @returns {Object} Research data with high-level intel and competitor intel
 */
export async function runDeepResearch(location, sectorName, businesses) {
  console.log(`[research] Running deep research for "${sectorName}" in "${location}"...`);

  const researchData = {
    sector: sectorName,
    location,
    businesses_count: businesses.length,
    high_level_intel: [],
    competitor_intel: [],
  };

  const sectorQuery = `${sectorName} in ${location} reviews complaints pricing competition`;
  
  // Find top competitors (by rating, with most reviews)
  const validRated = businesses.filter(b => b.rating !== null && b.rating !== undefined);
  const topCompetitors = validRated
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return (b.reviews || 0) - (a.reviews || 0);
    })
    .slice(0, 2);

  const promises = [];

  // 1. High-level market search
  promises.push(
    searchTavily(sectorQuery).then((results) => {
      researchData.high_level_intel = results;
    })
  );

  // 2. Competitor investigations
  topCompetitors.forEach((comp) => {
    const compQuery = `${comp.name} ${location} services price details quality of service`;
    promises.push(
      searchTavily(compQuery).then((results) => {
        researchData.competitor_intel.push({
          name: comp.name,
          rating: comp.rating,
          address: comp.address,
          url: comp.url,
          intel: results,
        });
      })
    );
  });

  await Promise.all(promises);
  return researchData;
}
