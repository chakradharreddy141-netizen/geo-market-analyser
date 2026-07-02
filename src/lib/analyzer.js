// Gemini SWOT Analyzer — Node.js port
// Calls Gemini API to produce structured competitive analysis, no sales pitch

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Analyze a single sector using Gemini AI
 * @param {string} location - Target location
 * @param {string} sectorName - Sector display name
 * @param {Array} gmapsData - Scraped Google Maps businesses
 * @param {Object} researchData - Tavily deep research results
 * @returns {Object} Structured sector analysis
 */
export async function analyzeWithGemini(location, sectorName, gmapsData, researchData) {
  if (!GEMINI_API_KEY) {
    console.log('[analyzer] Gemini API key not configured. Returning empty analysis.');
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  // Format businesses for prompt
  let gmapsSummary = '';
  for (let i = 0; i < gmapsData.length; i++) {
    const b = gmapsData[i];
    gmapsSummary += `[${i + 1}] Name: ${b.name}, Rating: ${b.rating ?? 'N/A'}, Reviews: ${b.reviews || 0}, Category: ${b.category}, Address: ${b.address}\n`;
  }

  // Format research for prompt
  let researchSummary = '';
  if (researchData) {
    if (researchData.high_level_intel?.length) {
      researchSummary += 'High Level Intel:\n';
      for (const item of researchData.high_level_intel) {
        researchSummary += `- ${item.title || 'Source'}: ${item.content || ''}\n`;
      }
    }
    if (researchData.competitor_intel?.length) {
      researchSummary += '\nCompetitor Intel:\n';
      for (const comp of researchData.competitor_intel) {
        researchSummary += `Competitor: ${comp.name}\n`;
        for (const res of (comp.intel || [])) {
          researchSummary += `  * ${res.title || 'Source'}: ${res.content || ''}\n`;
        }
      }
    }
  }

  const prompt = `You are an expert market analyst. Analyze the local business competition for the sector '${sectorName}' in '${location}'.

Here is the local business data scraped from Google Maps:
${gmapsSummary}

Here is additional deep research intelligence:
${researchSummary}

Provide a comprehensive competitive analysis. Identify local gaps, analyze competitor strengths and weaknesses, calculate an opportunity score (0 to 100) for a new business entering this market, and outline specific step-by-step strategies to overtake existing competitors.

Your response MUST be a valid JSON object matching this exact schema:
{
  "sector_name": "string",
  "total_businesses": 0,
  "average_rating": 0.0,
  "density_level": "Low | Medium | High",
  "saturation_index": "Low | Medium | High",
  "opportunity_score": 0,
  "market_summary": "A 2-3 sentence executive summary of the market condition",
  "gaps": ["Gap 1", "Gap 2"],
  "strengths": ["Competitor strength 1", "Competitor strength 2"],
  "weaknesses": ["Competitor weakness 1", "Competitor weakness 2"],
  "overtaking_strategies": ["Strategy 1", "Strategy 2"],
  "top_competitors": [
    {
      "name": "string",
      "rating": 0.0,
      "why_strong": "string"
    }
  ]
}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[analyzer] Calling Gemini API (attempt ${attempt}/${maxRetries})...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const cleanText = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          return JSON.parse(cleanText);
        }
      } else {
        const errText = await response.text();
        console.error(`[analyzer] Gemini API returned ${response.status}:`, errText.slice(0, 200));
      }
    } catch (err) {
      console.error(`[analyzer] Error calling Gemini (attempt ${attempt}):`, err.message);
    }

    if (attempt < maxRetries) {
      console.log('[analyzer] Waiting 2 seconds before retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return null;
}
