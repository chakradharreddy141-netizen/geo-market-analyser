import "./globals.css";

export const metadata = {
  title: "GeoOpportunity Analyzer — Local Business Intelligence",
  description:
    "Discover untapped business opportunities in any location. AI-powered market analysis using real Google Maps data, competitive intelligence, and SWOT strategies.",
  keywords: "business opportunity, market analysis, local business, SWOT analysis, competitive intelligence",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="mesh-bg" />
        <div className="noise-overlay" />

        <header className="site-header">
          <div className="container">
            <a href="/" className="site-logo" style={{ textDecoration: 'none' }}>
              <span className="site-logo-dot" />
              <div>
                <span className="site-logo-text">GeoOpportunity</span>
                <span className="site-logo-sub">Local Market Intelligence</span>
              </div>
            </a>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="container">
            <p>GeoOpportunity Analyzer &middot; Powered by Playwright, Tavily &amp; Gemini AI</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
