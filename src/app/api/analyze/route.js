// POST /api/analyze — Start a new analysis job
import { createJob, updateJob, addStep } from '@/lib/store';
import { scrapeGoogleMaps } from '@/lib/scraper';
import { runDeepResearch } from '@/lib/research';
import { analyzeWithGemini } from '@/lib/analyzer';
import { DEFAULT_SECTORS } from '@/lib/sectors';

export async function POST(request) {
  try {
    const body = await request.json();
    const { location, targetSector, customSector } = body;

    if (!location || !location.trim()) {
      return Response.json({ error: 'Location is required' }, { status: 400 });
    }

    // Generate unique job ID
    const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    // Determine which sectors to analyze
    let sectorsToAnalyze = [];
    const resolvedTarget = customSector?.trim() || targetSector;

    if (!resolvedTarget || resolvedTarget === 'none' || resolvedTarget === 'None — Analyze All Common Sectors') {
      sectorsToAnalyze = [...DEFAULT_SECTORS];
    } else {
      // Targeted sector first, plus 2 additional common sectors for comparison
      sectorsToAnalyze = [resolvedTarget];
      const extras = DEFAULT_SECTORS.filter(s => s !== resolvedTarget).slice(0, 2);
      sectorsToAnalyze.push(...extras);
    }

    // Create job
    createJob(jobId, location.trim(), resolvedTarget || 'All Sectors');

    // Launch background analysis (non-blocking)
    runAnalysis(jobId, location.trim(), sectorsToAnalyze, resolvedTarget).catch((err) => {
      console.error('[api/analyze] Background analysis error:', err);
      updateJob(jobId, { status: 'failed', error: err.message });
    });

    return Response.json({ jobId, sectorsCount: sectorsToAnalyze.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function runAnalysis(jobId, location, sectors, targetSector) {
  updateJob(jobId, { status: 'running', progress: 0 });

  const totalSteps = sectors.length * 3 + 1; // scrape + research + analyze per sector + final sort
  let completedSteps = 0;

  const sectorResults = [];
  const sectorBusinesses = {};

  for (let i = 0; i < sectors.length; i++) {
    const sector = sectors[i];

    // Step 1: Scrape Google Maps
    addStep(jobId, {
      type: 'scraping',
      sector,
      message: `Scanning Google Maps for ${sector}...`,
      index: i,
    });

    let businesses = [];
    try {
      businesses = await scrapeGoogleMaps(location, sector, (msg) => {
        // Update with live log messages
        addStep(jobId, { type: 'log', sector, message: msg, index: i });
      });
    } catch (err) {
      addStep(jobId, {
        type: 'error',
        sector,
        message: `Scraping failed for ${sector}: ${err.message}`,
        index: i,
      });
    }

    sectorBusinesses[sector] = businesses;
    completedSteps++;
    updateJob(jobId, { progress: Math.round((completedSteps / totalSteps) * 100) });

    addStep(jobId, {
      type: 'scraped',
      sector,
      message: `Found ${businesses.length} businesses in ${sector}`,
      count: businesses.length,
      index: i,
    });

    // Step 2: Deep Research (Tavily)
    addStep(jobId, {
      type: 'researching',
      sector,
      message: `Running deep market research for ${sector}...`,
      index: i,
    });

    let researchData = {};
    try {
      researchData = await runDeepResearch(location, sector, businesses);
    } catch (err) {
      addStep(jobId, {
        type: 'error',
        sector,
        message: `Research failed for ${sector}: ${err.message}`,
        index: i,
      });
    }

    completedSteps++;
    updateJob(jobId, { progress: Math.round((completedSteps / totalSteps) * 100) });

    // Step 3: Gemini Analysis
    addStep(jobId, {
      type: 'analyzing',
      sector,
      message: `Running AI competition analysis for ${sector}...`,
      index: i,
    });

    let analysis = null;
    try {
      analysis = await analyzeWithGemini(location, sector, businesses, researchData);
    } catch (err) {
      addStep(jobId, {
        type: 'error',
        sector,
        message: `Analysis failed for ${sector}: ${err.message}`,
        index: i,
      });
    }

    if (analysis) {
      sectorResults.push(analysis);
    }

    completedSteps++;
    updateJob(jobId, { progress: Math.round((completedSteps / totalSteps) * 100) });

    addStep(jobId, {
      type: 'analyzed',
      sector,
      message: `Completed analysis for ${sector}`,
      score: analysis?.opportunity_score || 0,
      index: i,
    });
  }

  // Sort results: targeted sector first, then by opportunity score descending
  sectorResults.sort((a, b) => {
    const aIsTarget = a.sector_name === targetSector;
    const bIsTarget = b.sector_name === targetSector;
    if (aIsTarget && !bIsTarget) return -1;
    if (!aIsTarget && bIsTarget) return 1;
    return (b.opportunity_score || 0) - (a.opportunity_score || 0);
  });

  // Calculate summary metrics
  const totalBusinesses = Object.values(sectorBusinesses).reduce((sum, arr) => sum + arr.length, 0);
  const lowestCompSector = [...sectorResults].sort((a, b) => {
    const densityMap = { Low: 1, Medium: 2, High: 3 };
    return (densityMap[a.density_level] || 2) - (densityMap[b.density_level] || 2);
  })[0]?.sector_name || '';

  const bestOpportunity = sectorResults[0]?.sector_name || '';

  const finalResults = {
    location,
    targetSector: targetSector || 'All Sectors',
    sectors: sectorResults,
    businesses: sectorBusinesses,
    summary: {
      total_sectors_analyzed: sectorResults.length,
      total_businesses_scraped: totalBusinesses,
      lowest_competition_sector: lowestCompSector,
      best_opportunity: bestOpportunity,
      highest_opportunity_score: sectorResults[0]?.opportunity_score || 0,
    },
  };

  completedSteps++;
  updateJob(jobId, {
    status: 'completed',
    progress: 100,
    results: finalResults,
  });

  addStep(jobId, {
    type: 'complete',
    message: `Analysis complete! ${sectorResults.length} sectors analyzed, ${totalBusinesses} businesses discovered.`,
  });
}
