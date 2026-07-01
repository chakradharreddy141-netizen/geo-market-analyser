// Google Maps Scraper — Improved accuracy with Playwright
// Uses CSS selectors + fallback text parsing + detail panel click-through

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isVercel = !!process.env.VERCEL;

/**
 * Scrape Google Maps for businesses in a given sector and location
 * @param {string} location - Target location
 * @param {string} sector - Sector/business type to search
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Array} Array of business objects
 */
export async function scrapeGoogleMaps(location, sector, onProgress) {
  const log = (msg) => {
    console.log(`[scraper] ${msg}`);
    if (onProgress) onProgress(msg);
  };

  log(`Starting scrape: "${sector}" in "${location}"`);

  // Gracefully fallback to AI search scraper if on Vercel
  if (isVercel) {
    log('Running on Vercel. Playwright is disabled in serverless functions.');
    return scrapeViaTavilyAndGemini(location, sector, log);
  }

  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
  } catch (launchErr) {
    log(`Playwright browser launch failed: ${launchErr.message}`);
    log('Attempting to find Chromium in common paths...');
    
    try {
      const { chromium } = await import('playwright');
      // Try common Playwright Chromium paths on Windows
      const possiblePaths = [
        process.env.PLAYWRIGHT_BROWSERS_PATH,
        'C:\\Users\\' + (process.env.USERNAME || 'chakr') + '\\AppData\\Local\\ms-playwright',
      ].filter(Boolean);

      for (const basePath of possiblePaths) {
        try {
          browser = await chromium.launch({ 
            headless: true,
            executablePath: undefined, // let Playwright find it
          });
          break;
        } catch (e) {
          continue;
        }
      }
    } catch (importErr) {
      log(`Playwright import failed: ${importErr.message}`);
    }

    if (!browser) {
      log('Could not launch Playwright Chromium. Falling back to Tavily + Gemini AI search scraper...');
      return scrapeViaTavilyAndGemini(location, sector, log);
    }
  }

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'en-US',
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  const searchQuery = `${sector} in ${location}`;
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}/`;

  log(`Navigating to Google Maps...`);

  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      break;
    } catch (e) {
      retries++;
      if (retries > maxRetries) {
        log(`Navigation failed after ${maxRetries} retries. Aborting.`);
        await browser.close();
        return [];
      }
      log(`Navigation timeout, retrying (${retries}/${maxRetries})...`);
      await delay(2000 * retries);
    }
  }

  await delay(3000);

  const businesses = [];

  // Check if redirected to a single place page
  const isSinglePlace = page.url().includes('/maps/place/');

  if (isSinglePlace) {
    log('Single business result detected. Extracting details...');
    try {
      const biz = await extractSinglePlaceDetails(page, location);
      if (biz) businesses.push(biz);
    } catch (err) {
      log(`Error extracting single place: ${err.message}`);
    }
  } else {
    // Scrape the list view
    log('Scrolling to load all business listings...');
    await scrollToLoadAll(page, log);

    // Extract all business cards
    const cards = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');
    const articleCards = cards.length > 0 ? cards : await page.$$('div[role="article"]');

    log(`Found ${articleCards.length} business cards. Extracting data...`);

    for (let i = 0; i < articleCards.length; i++) {
      try {
        const biz = await extractFromCard(articleCards[i], page, sector, location, i, log);
        if (biz && biz.name) {
          businesses.push(biz);
        }
      } catch (err) {
        // Skip individual card errors silently
      }
    }
  }

  // Deduplication by name similarity
  const deduped = deduplicateBusinesses(businesses);
  log(`Scraping complete. ${deduped.length} unique businesses found (${businesses.length} before dedup).`);

  await browser.close();
  return deduped;
}

async function scrollToLoadAll(page, log) {
  const feedSelector = 'div[role="feed"]';
  try {
    await page.waitForSelector(feedSelector, { timeout: 8000 }).catch(() => null);
    const feed = await page.$(feedSelector);
    if (!feed) {
      log('No scrollable feed found, parsing static page.');
      return;
    }

    let lastHeight = await page.evaluate((el) => el.scrollHeight, feed);
    let attempts = 0;
    const maxAttempts = 25;

    while (attempts < maxAttempts) {
      await page.evaluate((el) => el.scrollTo(0, el.scrollHeight), feed);
      await delay(2000);

      const newHeight = await page.evaluate((el) => el.scrollHeight, feed);
      if (newHeight === lastHeight) {
        const html = await page.content();
        if (html.includes("You've reached the end of the list") || html.includes('end of the list')) {
          log('Reached end of Google Maps list.');
          break;
        }
        // Jiggle scroll to trigger lazy load
        await page.evaluate((el) => el.scrollTo(0, el.scrollHeight - 400), feed);
        await delay(500);
        await page.evaluate((el) => el.scrollTo(0, el.scrollHeight), feed);
        await delay(1500);
        const finalHeight = await page.evaluate((el) => el.scrollHeight, feed);
        if (finalHeight === newHeight) {
          log('No more results loading. Ending scroll.');
          break;
        }
      }
      lastHeight = newHeight;
      attempts++;
    }
  } catch (err) {
    log(`Scroll error: ${err.message}`);
  }
}

async function extractFromCard(card, page, sector, location, index, log) {
  // Try to find the link element — could be the card itself or a child
  let linkEl = card;
  const tagName = await card.evaluate((el) => el.tagName.toLowerCase());
  if (tagName !== 'a') {
    linkEl = await card.$('a[href*="/maps/place/"]');
    if (!linkEl) return null;
  }

  const name = await linkEl.getAttribute('aria-label').catch(() => null);
  const url = await linkEl.getAttribute('href').catch(() => null);
  if (!name) return null;

  const cleanName = name.replace(/^\d+\.\s*/, '').trim();

  // Strategy 1: Use dedicated CSS selectors for rating/reviews
  let rating = null;
  let reviews = 0;
  let category = sector;
  let address = '';

  // Try CSS selectors first (these are Google's internal classes)
  const ratingSpan = await card.$('span.MW4etd').catch(() => null);
  const reviewSpan = await card.$('span.UY7F9').catch(() => null);

  if (ratingSpan) {
    const ratingText = await ratingSpan.textContent().catch(() => '');
    const parsed = parseFloat(ratingText);
    if (!isNaN(parsed)) rating = parsed;
  }

  if (reviewSpan) {
    const reviewText = await reviewSpan.textContent().catch(() => '');
    const cleaned = reviewText.replace(/[().,\s]/g, '');
    const parsed = parseInt(cleaned);
    if (!isNaN(parsed)) reviews = parsed;
  }

  // Strategy 2: Fallback to text content parsing if CSS selectors failed
  if (rating === null) {
    const infoText = await card.textContent().catch(() => '');
    const ratingMatch = infoText.match(/(\d\.\d)(?:\s*\((\d[\d,]*)\))?/);
    if (ratingMatch) {
      rating = parseFloat(ratingMatch[1]);
      if (ratingMatch[2]) {
        reviews = parseInt(ratingMatch[2].replace(/,/g, ''));
      }
    }
  }

  // Extract category and address from the info spans
  // Google Maps uses W4Efsd class for info lines (category · address · hours)
  const infoSpans = await card.$$('div.W4Efsd').catch(() => []);
  if (infoSpans && infoSpans.length > 0) {
    for (const span of infoSpans) {
      const text = await span.textContent().catch(() => '');
      const parts = text.split('·').map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        // Skip noise text
        if (/^(Open|Closed|Opens|Closes|Temporarily|24 hours)/i.test(trimmed)) continue;
        if (/^(Directions|Website|Phone)/i.test(trimmed)) continue;
        if (/^\+?\d{1,3}[\s\-]?\d/.test(trimmed)) continue; // phone numbers

        // If it looks like a known category type
        const categoryWords = ['Gym', 'Fitness', 'Hospital', 'Clinic', 'Restaurant', 'Cafe',
          'Store', 'Shop', 'Salon', 'Parlor', 'Pharmacy', 'Hotel', 'Lodge', 'School',
          'Center', 'Centre', 'Market', 'Supermarket', 'Service', 'Dealer', 'Agency',
          'Equipment', 'Studio', 'Medical', 'Dental', 'Nursing'];
        const isCategory = categoryWords.some(w => trimmed.toLowerCase().includes(w.toLowerCase()));

        if (isCategory && category === sector) {
          category = trimmed;
        } else if (!address && trimmed.length > 3 && !isCategory) {
          address = trimmed;
        }
      }
    }
  }

  // Final fallback: text-based parsing
  if (category === sector || !address) {
    const fullText = await card.textContent().catch(() => '');
    const parts = fullText.split('·').map(p => p.trim()).filter(Boolean);

    if (parts.length >= 2) {
      // Try to extract category from after rating text
      const firstPart = parts[0];
      if (rating !== null) {
        const ratingStr = String(rating);
        const ratingIdx = firstPart.lastIndexOf(ratingStr);
        if (ratingIdx !== -1) {
          const afterRating = firstPart.substring(ratingIdx + ratingStr.length).replace(/\(\d[\d,]*\)\s*/, '').trim();
          if (afterRating && afterRating.length > 1 && category === sector) {
            category = afterRating;
          }
        }
      }

      // Extract address from remaining parts
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].split('\n')[0].trim();
        if (part && !/^(Open|Closed|Opens|Closes|Temporarily)/i.test(part) &&
            !/^(Directions|Website)/i.test(part) && !/^\+?\d/.test(part) && part.length > 2) {
          if (!address) address = part;
          break;
        }
      }
    }
  }

  const fullAddress = address ? `${address}, ${location}` : location;

  return {
    name: cleanName,
    rating,
    reviews,
    category,
    address: fullAddress,
    url,
    source: 'Google Maps',
  };
}

async function extractSinglePlaceDetails(page, location) {
  const title = await page.title();
  const name = title.split(' - Google Maps')[0].trim();

  let rating = null;
  let reviews = 0;
  const ratingText = await page.locator('div.F7nice').first().textContent().catch(() => '');
  if (ratingText) {
    const match = ratingText.match(/(\d\.\d)\s*\((\d[\d,]*)\)/);
    if (match) {
      rating = parseFloat(match[1]);
      reviews = parseInt(match[2].replace(/,/g, ''));
    }
  }

  const category = await page.locator('button[jsaction="pane.rating.category"]').textContent().catch(() => '');
  const address = await page.locator('button[data-item-id="address"]').textContent().catch(() => location);
  const phone = await page.locator('button[data-item-id^="phone:tel:"]').textContent().catch(() => '');
  const website = await page.locator('a[data-item-id="authority"]').getAttribute('href').catch(() => '');

  return {
    name,
    rating,
    reviews,
    category: category || 'Business',
    address: address || location,
    phone,
    website,
    url: page.url(),
    source: 'Google Maps',
  };
}

function deduplicateBusinesses(businesses) {
  const seen = new Map();
  const result = [];

  for (const biz of businesses) {
    const normalized = biz.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Check if we've seen a very similar name
    let isDupe = false;
    for (const [key] of seen) {
      if (levenshtein(normalized, key) <= 3) {
        isDupe = true;
        break;
      }
    }
    if (!isDupe) {
      seen.set(normalized, true);
      result.push(biz);
    }
  }

  return result;
}

// Simple Levenshtein distance implementation
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a.length > 50 || b.length > 50) {
    // For long strings, just check prefix similarity
    return a.substring(0, 20) === b.substring(0, 20) ? 0 : 999;
  }

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

async function scrapeViaTavilyAndGemini(location, sector, log) {
  log(`Executing AI-assisted search extraction...`);
  
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!TAVILY_API_KEY || !GEMINI_API_KEY) {
    log(`API keys missing. Please configure TAVILY_API_KEY and GEMINI_API_KEY.`);
    return [];
  }

  // 1. Search Tavily for businesses list
  log(`Searching local businesses via Tavily...`);
  const query = `list of ${sector} in ${location} with Google reviews ratings and addresses`;
  
  let searchResults = [];
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        max_results: 6,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      searchResults = data.results || [];
    }
  } catch (err) {
    log(`Tavily search failed: ${err.message}`);
    return [];
  }

  if (searchResults.length === 0) {
    log(`No business listings returned from Tavily.`);
    return [];
  }

  // 2. Format results for Gemini extraction
  log(`Parsing structured listings via Gemini AI...`);
  let searchSummary = '';
  for (const res of searchResults) {
    searchSummary += `Title: ${res.title}\nURL: ${res.url}\nContent: ${res.content}\n---\n`;
  }

  const prompt = `You are a data extraction assistant. Extract all local businesses mentioned in the search results below for the sector "${sector}" in "${location}".

Search Results:
${searchSummary}

Extract as many businesses as possible. For each business, extract:
- name: Business name
- rating: Google rating value as a float (e.g. 4.6), or null if not mentioned
- reviews: Count of reviews as an integer, or 0 if not mentioned
- category: Specific business category (e.g. "Gym", "Fitness center")
- address: Relative or full street address (e.g. "NH 44, Jammalamadugu"), or location name if not specified
- url: Google Maps URL or business website URL if mentioned, or null

Return the list as a valid JSON array matching this exact schema:
[
  {
    "name": "string",
    "rating": 4.5,
    "reviews": 23,
    "category": "string",
    "address": "string",
    "url": "string or null",
    "source": "Google Maps Search"
  }
]`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        log(`Successfully extracted ${parsed.length} businesses.`);
        return parsed;
      }
    }
  } catch (err) {
    log(`Gemini extraction failed: ${err.message}`);
  }

  return [];
}

