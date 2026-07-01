"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LOADING_INSIGHTS, SECTORS } from "@/lib/sectors";

function ResultsContent() {
  const searchParams = useSearchParams();
  const location = searchParams.get("location") || "";
  const targetSector = searchParams.get("targetSector") || "none";

  const [status, setStatus] = useState("connecting");
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expandedSectors, setExpandedSectors] = useState({});
  const [insightIdx, setInsightIdx] = useState(0);
  const logRef = useRef(null);

  // Sector calculation
  const defaultSectors = ["Restaurants", "Supermarkets", "Gyms", "Pharmacies", "Clothing Stores"];
  let sectorsToAnalyze = [];
  if (targetSector !== "none") {
    sectorsToAnalyze.push(targetSector);
    sectorsToAnalyze.push(...defaultSectors.filter((s) => s.toLowerCase() !== targetSector.toLowerCase()).slice(0, 2));
  } else {
    sectorsToAnalyze = defaultSectors.slice(0, 3);
  }

  // Rotate insight cards
  useEffect(() => {
    const timer = setInterval(() => {
      setInsightIdx((prev) => (prev + 1) % LOADING_INSIGHTS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Orchestrate analysis loop
  useEffect(() => {
    if (!location) {
      setError("No location provided.");
      setStatus("failed");
      return;
    }

    const runAnalysis = async () => {
      setStatus("running");
      const localResults = {
        location,
        targetSector: targetSector !== "none" ? targetSector : "All Sectors",
        sectors: [],
        businesses: {},
        summary: {}
      };

      try {
        for (let i = 0; i < sectorsToAnalyze.length; i++) {
          const sector = sectorsToAnalyze[i];
          const pct = Math.floor((i / sectorsToAnalyze.length) * 100);
          setProgress(pct);

          setSteps((prev) => [...prev, { type: "log", sector, message: `Initializing analysis for ${sector}...` }]);
          setSteps((prev) => [...prev, { type: "log", sector, message: `Scraping Google Maps data for ${sector}...` }]);

          const res = await fetch('/api/analyze-sector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location, sector })
          });

          if (!res.ok) {
            throw new Error(`Failed to analyze ${sector} (Status ${res.status})`);
          }

          const data = await res.json();
          if (data.error) {
            setSteps((prev) => [...prev, { type: "error", sector, message: `Error: ${data.error}` }]);
            continue;
          }

          // Accumulate data
          if (data.analysis) {
            localResults.sectors.push(data.analysis);
            setSteps((prev) => [
              ...prev,
              { type: "analyzed", sector, score: data.analysis.opportunity_score, message: `Analyzed ${sector}` }
            ]);
          }
          
          if (data.businesses) {
            localResults.businesses[data.sectorName] = data.businesses;
            setSteps((prev) => [
              ...prev,
              { type: "scraped", sector, count: data.businesses.length, message: `Found ${data.businesses.length} businesses` }
            ]);
          }
        }

        setProgress(100);

        // Summarize
        if (localResults.sectors.length > 0) {
          localResults.sectors.sort((a, b) => b.opportunity_score - a.opportunity_score);
          let totalBusinesses = 0;
          Object.values(localResults.businesses).forEach((arr) => {
            totalBusinesses += arr.length;
          });

          localResults.summary = {
            total_sectors_analyzed: localResults.sectors.length,
            total_businesses_scraped: totalBusinesses,
            best_opportunity: localResults.sectors[0].sector_name,
            lowest_competition_sector: localResults.sectors.reduce((prev, current) =>
              prev.density_level === "Low" ? prev : current
            ).sector_name,
          };
          
          setResults(localResults);
          setStatus("completed");
        } else {
          setError("No data could be analyzed.");
          setStatus("failed");
        }
      } catch (err) {
        setError(err.message);
        setStatus("failed");
      }
    };

    runAnalysis();
  }, [location, targetSector]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [steps]);

  const toggleExpand = (sectorName) => {
    setExpandedSectors((prev) => ({
      ...prev,
      [sectorName]: !prev[sectorName],
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 75) return "var(--mint)";
    if (score >= 50) return "var(--gold)";
    return "var(--red)";
  };

  const getPhaseStatus = (sector) => {
    const sectorSteps = steps.filter((s) => s.sector === sector);
    const hasAnalyzed = sectorSteps.some((s) => s.type === "analyzed");
    const hasError = sectorSteps.some((s) => s.type === "error");
    const isActive =
      !hasAnalyzed &&
      sectorSteps.length > 0 &&
      status === "running";
    return { done: hasAnalyzed, active: isActive, error: hasError };
  };

  // ===== PROGRESS VIEW =====
  if (status !== "completed" || !results) {
    const logMessages = steps.filter(
      (s) => s.type === "log" || s.type === "scraped" || s.type === "analyzed" || s.type === "error" || s.type === "complete"
    );

    return (
      <div className="container" style={{ paddingTop: "3rem", paddingBottom: "4rem", maxWidth: "800px" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <p className="text-label text-mint" style={{ marginBottom: "0.5rem" }}>
            Analysis In Progress
          </p>
          <h1 className="text-heading">Scanning the market for you...</h1>
          <p className="text-caption" style={{ marginTop: "0.5rem" }}>
            Analyzing each sector via Google Maps and AI...
          </p>

          <div
            style={{
              marginTop: "1.5rem",
              height: "4px",
              background: "var(--surface-raised)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(90deg, var(--mint), var(--gold))",
                borderRadius: "2px",
                transition: "width 0.8s ease",
              }}
            />
          </div>
          <p
            className="text-caption"
            style={{ marginTop: "0.5rem", fontFamily: "var(--font-mono)" }}
          >
            {progress}% complete
          </p>
        </div>

        <div className="insight-carousel" style={{ marginBottom: "2rem" }}>
          {LOADING_INSIGHTS.map((insight, idx) => (
            <div
              key={idx}
              className={`insight-card ${idx === insightIdx ? "active" : ""}`}
            >
              <span className="insight-icon">{insight.icon}</span>
              <span className="insight-text">{insight.text}</span>
            </div>
          ))}
        </div>

        <div className="card-static" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <p
            className="text-label"
            style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}
          >
            Sector Progress
          </p>
          <div className="progress-timeline">
            {sectorsToAnalyze.map((sector, idx) => {
              const phase = getPhaseStatus(sector);
              const sectorSteps = steps.filter((s) => s.sector === sector);
              const businessCount = sectorSteps.find((s) => s.type === "scraped")?.count;
              const score = sectorSteps.find((s) => s.type === "analyzed")?.score;

              return (
                <div
                  key={sector}
                  className={`progress-step ${phase.done ? "done" : ""} ${phase.active ? "active" : ""}`}
                >
                  <div className="progress-dot">
                    {phase.done ? "✓" : idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.9375rem",
                        color: phase.done
                          ? "var(--text-primary)"
                          : phase.active
                          ? "var(--mint)"
                          : "var(--text-muted)",
                      }}
                    >
                      {sector}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      {phase.done && businessCount !== undefined && (
                        <span>
                          {businessCount} businesses found
                          {score !== undefined && ` · Score: ${score}%`}
                        </span>
                      )}
                      {phase.active && (
                        <span style={{ color: "var(--mint)" }}>
                          {sectorSteps[sectorSteps.length - 1]?.message || "Processing..."}
                        </span>
                      )}
                      {!phase.done && !phase.active && "Waiting..."}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {logMessages.length > 0 && (
          <div className="card-static" style={{ padding: "1rem" }}>
            <p className="text-label" style={{ marginBottom: "0.75rem", color: "var(--text-muted)" }}>
              Live Log
            </p>
            <div className="log-terminal" ref={logRef}>
              {logMessages.slice(-20).map((entry, idx) => (
                <div key={idx} className="log-entry">
                  <span className="log-prefix">›</span>
                  <span className="log-msg">{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div
            className="card-static"
            style={{
              padding: "1rem 1.5rem",
              marginTop: "1.5rem",
              borderColor: "rgba(239, 68, 68, 0.2)",
            }}
          >
            <p style={{ color: "var(--red)", fontSize: "0.875rem" }}>
              ⚠ Error: {error}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ===== RESULTS VIEW =====
  return (
    <div className="container" style={{ paddingBottom: "2rem" }}>
      <div className="results-header">
        <p className="text-label text-mint" style={{ marginBottom: "0.25rem" }}>
          Analysis Complete
        </p>
        <h1>
          {results.location}
          {results.targetSector && results.targetSector !== "All Sectors" && (
            <span className="text-gold"> · {results.targetSector}</span>
          )}
        </h1>
        <div className="results-stats">
          <div className="results-stat">
            <span className="results-stat-value">
              {results.summary.total_businesses_scraped}
            </span>
            <span className="results-stat-label">Businesses Found</span>
          </div>
          <div className="results-stat">
            <span className="results-stat-value">
              {results.summary.total_sectors_analyzed}
            </span>
            <span className="results-stat-label">Sectors Analyzed</span>
          </div>
          <div className="results-stat">
            <span className="results-stat-value" style={{ color: "var(--gold)" }}>
              {results.summary.best_opportunity || "—"}
            </span>
            <span className="results-stat-label">Best Opportunity</span>
          </div>
          <div className="results-stat">
            <span className="results-stat-value">
              {results.summary.lowest_competition_sector || "—"}
            </span>
            <span className="results-stat-label">Lowest Competition</span>
          </div>
        </div>
      </div>

      <div className="results-grid">
        {results.sectors.map((sector, idx) => {
          const isExpanded = expandedSectors[sector.sector_name];
          const sectorBusinesses = results.businesses[sector.sector_name] || [];
          const scoreColor = getScoreColor(sector.opportunity_score);
          const isTarget = sector.sector_name === results.targetSector;

          return (
            <div
              key={sector.sector_name}
              className="card-static sector-card"
              style={isTarget ? { borderColor: "rgba(217, 119, 6, 0.2)" } : {}}
            >
              {isTarget && (
                <div className="badge badge-gold" style={{ marginBottom: "0.75rem" }}>
                  ★ Targeted Sector
                </div>
              )}

              <div className="sector-card-header">
                <div className="sector-card-info">
                  <p className="text-label">Sector #{idx + 1}</p>
                  <h2>{sector.sector_name}</h2>
                  {sector.market_summary && (
                    <p className="sector-card-summary">{sector.market_summary}</p>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                    <span className="badge badge-mint">{sector.density_level} Density</span>
                    <span className="badge badge-gold">{sector.saturation_index} Saturation</span>
                    <span className="badge badge-mint">
                      {sector.total_businesses} businesses
                    </span>
                    {sector.average_rating && (
                      <span className="badge badge-gold">
                        ★ {sector.average_rating.toFixed(1)} avg
                      </span>
                    )}
                  </div>
                </div>

                <div className="sector-card-metrics">
                  <div
                    className="gauge"
                    style={{ "--gauge-pct": sector.opportunity_score, "--gauge-color": scoreColor }}
                  >
                    <div className="gauge-ring" />
                    <span className="gauge-value">{sector.opportunity_score}</span>
                    <span className="gauge-label">Opportunity</span>
                  </div>
                </div>
              </div>

              {sector.top_competitors?.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <p className="text-label" style={{ marginBottom: "0.5rem" }}>
                    Top Competitors
                  </p>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {sector.top_competitors.map((comp, ci) => (
                      <div
                        key={ci}
                        style={{
                          padding: "0.625rem 1rem",
                          background: "var(--surface-raised)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.8125rem",
                          flex: "1 1 200px",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {comp.name}
                          {comp.rating && (
                            <span className="text-gold" style={{ marginLeft: "0.5rem", fontWeight: 400 }}>
                              ★ {comp.rating}
                            </span>
                          )}
                        </div>
                        {comp.why_strong && (
                          <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                            {comp.why_strong}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                className="expand-toggle"
                onClick={() => toggleExpand(sector.sector_name)}
              >
                {isExpanded ? "▾ Hide Details" : "▸ Show SWOT Analysis & Businesses"}
              </button>

              <div className={`expand-content ${isExpanded ? "expanded" : ""}`}>
                <div style={{ paddingTop: "1.5rem" }}>
                  <div className="swot-grid" style={{ marginBottom: "1.5rem" }}>
                    <div className="swot-cell swot-strengths">
                      <h4>Strengths</h4>
                      <ul>
                        {(sector.strengths || []).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="swot-cell swot-weaknesses">
                      <h4>Weaknesses</h4>
                      <ul>
                        {(sector.weaknesses || []).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="swot-cell swot-gaps">
                      <h4>Market Gaps</h4>
                      <ul>
                        {(sector.gaps || []).map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="swot-cell swot-strategies">
                      <h4>Overtaking Strategies</h4>
                      <ul>
                        {(sector.overtaking_strategies || []).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <p
                    className="text-label"
                    style={{ marginBottom: "0.75rem", color: "var(--text-secondary)" }}
                  >
                    Discovered Businesses ({sectorBusinesses.length})
                  </p>
                  <div className="table-wrap" style={{ maxHeight: "400px", overflowY: "auto" }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Business Name</th>
                          <th>Category</th>
                          <th>Rating</th>
                          <th>Reviews</th>
                          <th>Address</th>
                          <th>Maps</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectorBusinesses.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                              No businesses discovered.
                            </td>
                          </tr>
                        ) : (
                          sectorBusinesses.map((biz, bi) => (
                            <tr key={bi}>
                              <td style={{ color: "var(--text-muted)" }}>{bi + 1}</td>
                              <td>{biz.name}</td>
                              <td>
                                <span className="badge badge-mint">{biz.category}</span>
                              </td>
                              <td>
                                {biz.rating !== null ? (
                                  <span className="text-gold">★ {biz.rating}</span>
                                ) : (
                                  <span style={{ color: "var(--text-muted)" }}>—</span>
                                )}
                              </td>
                              <td>{biz.reviews || "—"}</td>
                              <td
                                style={{
                                  maxWidth: "200px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={biz.address}
                              >
                                {biz.address}
                              </td>
                              <td>
                                {biz.url ? (
                                  <a
                                    href={biz.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: "var(--mint)",
                                      fontSize: "0.75rem",
                                      textDecoration: "none",
                                    }}
                                  >
                                    View ↗
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="container" style={{paddingTop:"3rem", textAlign:"center"}}>Loading...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
