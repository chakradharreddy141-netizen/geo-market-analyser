// Sector definitions with icons (emoji) and search terms for Google Maps
export const SECTORS = [
  {
    id: 'none',
    name: 'None — Analyze All Common Sectors',
    icon: '🔍',
    searchTerms: null, // Will use top 5 common sectors
    isSpecial: true,
  },
  {
    id: 'gyms',
    name: 'Gyms & Fitness Centers',
    icon: '💪',
    searchTerms: ['Gyms', 'Fitness Centers', 'Health Club'],
  },
  {
    id: 'supermarkets',
    name: 'Supermarkets & Provision Stores',
    icon: '🛒',
    searchTerms: ['Supermarkets', 'Provision Stores', 'Grocery Stores'],
  },
  {
    id: 'hospitals',
    name: 'Hospitals & Clinics',
    icon: '🏥',
    searchTerms: ['Hospitals', 'Clinics', 'Medical Centers'],
  },
  {
    id: 'restaurants',
    name: 'Restaurants & Cafes',
    icon: '🍽️',
    searchTerms: ['Restaurants', 'Cafes', 'Food Courts'],
  },
  {
    id: 'education',
    name: 'Education & Coaching Centers',
    icon: '📚',
    searchTerms: ['Coaching Centers', 'Tuition Centers', 'Training Institutes'],
  },
  {
    id: 'electronics',
    name: 'Electronics & Mobile Stores',
    icon: '📱',
    searchTerms: ['Electronics Stores', 'Mobile Phone Shops', 'Computer Stores'],
  },
  {
    id: 'salons',
    name: 'Salons & Beauty Parlors',
    icon: '💇',
    searchTerms: ['Beauty Salons', 'Hair Salons', 'Beauty Parlors'],
  },
  {
    id: 'pharmacies',
    name: 'Pharmacies & Medical Stores',
    icon: '💊',
    searchTerms: ['Pharmacies', 'Medical Stores', 'Drug Stores'],
  },
  {
    id: 'realestate',
    name: 'Real Estate & Construction',
    icon: '🏗️',
    searchTerms: ['Real Estate Agents', 'Construction Companies', 'Property Dealers'],
  },
  {
    id: 'automobile',
    name: 'Automobile Services & Workshops',
    icon: '🔧',
    searchTerms: ['Auto Repair Shops', 'Car Service Centers', 'Automobile Workshops'],
  },
  {
    id: 'hotels',
    name: 'Hotels & Lodging',
    icon: '🏨',
    searchTerms: ['Hotels', 'Lodges', 'Guest Houses'],
  },
  {
    id: 'clothing',
    name: 'Clothing & Fashion Stores',
    icon: '👗',
    searchTerms: ['Clothing Stores', 'Fashion Boutiques', 'Garment Shops'],
  },
  {
    id: 'it',
    name: 'IT & Software Services',
    icon: '💻',
    searchTerms: ['IT Services', 'Software Companies', 'Computer Centers'],
  },
  {
    id: 'banking',
    name: 'Banking & Financial Services',
    icon: '🏦',
    searchTerms: ['Banks', 'Financial Services', 'Insurance Agents'],
  },
  {
    id: 'agriculture',
    name: 'Agriculture & Farming Supplies',
    icon: '🌾',
    searchTerms: ['Agricultural Supplies', 'Fertilizer Shops', 'Farm Equipment'],
  },
  {
    id: 'other',
    name: 'Other (Type it here)',
    icon: '✏️',
    searchTerms: null, // User provides custom name
    isSpecial: true,
  },
];

// Default sectors to analyze when "None" is selected
export const DEFAULT_SECTORS = [
  'Gyms & Fitness Centers',
  'Supermarkets & Provision Stores',
  'Hospitals & Clinics',
  'Restaurants & Cafes',
  'Salons & Beauty Parlors',
];

// Rotating insight cards shown during the progress/loading phase
export const LOADING_INSIGHTS = [
  {
    icon: '📊',
    text: 'Did you know? 64% of small businesses fail because they ignored local competition before launching.',
  },
  {
    icon: '⭐',
    text: 'Businesses with 4.5+ Google ratings get 35% more foot traffic than those below 4.0.',
  },
  {
    icon: '🏪',
    text: 'The average Indian town has 3x more provision stores than gyms — but gyms have 5x higher profit margins.',
  },
  {
    icon: '💡',
    text: 'Pro tip: Low-rated competitors = high opportunity. A 3-star market gap is your 5-star entry point.',
  },
  {
    icon: '📍',
    text: '82% of consumers search "near me" on Google Maps before visiting a local business.',
  },
  {
    icon: '🚀',
    text: 'Businesses that launch with a competitive analysis are 2.5x more likely to survive their first 3 years.',
  },
  {
    icon: '🔎',
    text: 'We scan real Google Maps data — not generic directories. Every business you see is verified and geolocated.',
  },
  {
    icon: '🎯',
    text: 'Markets with high density but low average ratings are the sweet spot — high demand, poor supply.',
  },
  {
    icon: '📈',
    text: 'Towns with fewer than 10 businesses in a sector often indicate an underserved market ripe for entry.',
  },
  {
    icon: '🤝',
    text: 'Understanding competitor weaknesses lets you position your USP from day one — no guesswork needed.',
  },
];

export function getSectorById(id) {
  return SECTORS.find(s => s.id === id) || null;
}

export function getSectorByName(name) {
  return SECTORS.find(s => s.name === name) || null;
}
