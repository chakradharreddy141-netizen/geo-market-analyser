"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTORS } from "@/lib/sectors";

export default function HomePage() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [selectedSector, setSelectedSector] = useState("none");
  const [customSector, setCustomSector] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location.trim()) {
      setError("Please enter a location.");
      return;
    }
    if (selectedSector === "other" && !customSector.trim()) {
      setError("Please type your custom sector name.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const payload = {
        location: location.trim(),
        targetSector: selectedSector,
        customSector: selectedSector === "other" ? customSector.trim() : null,
      };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start analysis");
      }

      const { jobId } = await res.json();
      router.push(`/results/${jobId}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-badge">
          <span style={{ fontSize: "0.875rem" }}>⚡</span>
          AI-Powered Local Market Intelligence
        </div>

        <h1 className="text-display">
          Discover Untapped
          <br />
          <span className="text-mint">Business Opportunities</span>
        </h1>

        <p className="hero-subtitle">
          Enter any location and we&apos;ll scan Google Maps, run deep competitor
          research, and generate a comprehensive SWOT analysis — all in minutes.
        </p>

        <form className="hero-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="location">Target Location</label>
            <input
              id="location"
              type="text"
              className="input"
              placeholder="e.g. Jammalamadugu, Andhra Pradesh"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label htmlFor="sector">Focus Sector</label>
            <select
              id="sector"
              className="select"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              disabled={loading}
            >
              {SECTORS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>

          {selectedSector === "other" && (
            <div className="input-group" style={{ animation: "fadeInUp 0.4s ease-out" }}>
              <label htmlFor="customSector">Custom Sector Name</label>
              <input
                id="customSector"
                type="text"
                className="input"
                placeholder="e.g. Pet Shops & Veterinary Clinics"
                value={customSector}
                onChange={(e) => setCustomSector(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {error && (
            <p style={{ color: "var(--red)", fontSize: "0.8125rem" }}>{error}</p>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? (
              <>
                <span className="spinner" />
                Starting Analysis...
              </>
            ) : (
              <>
                <span style={{ fontSize: "1.125rem" }}>🔍</span>
                Analyze Market
              </>
            )}
          </button>
        </form>
      </section>

      {/* How It Works Section */}
      <section className="steps-section">
        <div className="container">
          <p className="text-label text-mint" style={{ marginBottom: "0.5rem" }}>
            How It Works
          </p>
          <h2 className="text-heading">Three Steps to Market Intel</h2>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Scrape</h3>
              <p>
                We deploy a headless browser to scan every business listing on
                Google Maps — names, ratings, reviews, categories, and addresses.
              </p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Research</h3>
              <p>
                Deep search queries analyze top competitors, customer sentiment,
                pricing trends, and market gaps using Tavily intelligence.
              </p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Analyze</h3>
              <p>
                Gemini AI synthesizes all data into a SWOT matrix, opportunity scores,
                and step-by-step strategies to overtake competitors.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
