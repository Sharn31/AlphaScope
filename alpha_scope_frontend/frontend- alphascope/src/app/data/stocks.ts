// Popular stocks database for autocomplete
export interface StockOption {
  symbol: string;
  name: string;
  exchange: string;
  sector?: string;
}

export const POPULAR_STOCKS: StockOption[] = [
  // Tech Giants
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "GOOGL", name: "Alphabet Inc. Class A", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "GOOG", name: "Alphabet Inc. Class C", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "AMZN", name: "Amazon.com Inc.", exchange: "NASDAQ", sector: "Consumer Cyclical" },
  { symbol: "META", name: "Meta Platforms Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "TSLA", name: "Tesla Inc.", exchange: "NASDAQ", sector: "Automotive" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "AMD", name: "Advanced Micro Devices Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "INTC", name: "Intel Corporation", exchange: "NASDAQ", sector: "Technology" },
  
  // Financial Services
  { symbol: "JPM", name: "JPMorgan Chase & Co.", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "BAC", name: "Bank of America Corp.", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "WFC", name: "Wells Fargo & Company", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "GS", name: "Goldman Sachs Group Inc.", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "MS", name: "Morgan Stanley", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "V", name: "Visa Inc.", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "MA", name: "Mastercard Inc.", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "AXP", name: "American Express Company", exchange: "NYSE", sector: "Financial Services" },
  
  // Healthcare & Pharma
  { symbol: "JNJ", name: "Johnson & Johnson", exchange: "NYSE", sector: "Healthcare" },
  { symbol: "UNH", name: "UnitedHealth Group Inc.", exchange: "NYSE", sector: "Healthcare" },
  { symbol: "PFE", name: "Pfizer Inc.", exchange: "NYSE", sector: "Healthcare" },
  { symbol: "ABBV", name: "AbbVie Inc.", exchange: "NYSE", sector: "Healthcare" },
  { symbol: "MRK", name: "Merck & Co. Inc.", exchange: "NYSE", sector: "Healthcare" },
  { symbol: "TMO", name: "Thermo Fisher Scientific Inc.", exchange: "NYSE", sector: "Healthcare" },
  
  // Consumer & Retail
  { symbol: "WMT", name: "Walmart Inc.", exchange: "NYSE", sector: "Consumer Defensive" },
  { symbol: "HD", name: "Home Depot Inc.", exchange: "NYSE", sector: "Consumer Cyclical" },
  { symbol: "NKE", name: "Nike Inc.", exchange: "NYSE", sector: "Consumer Cyclical" },
  { symbol: "MCD", name: "McDonald's Corporation", exchange: "NYSE", sector: "Consumer Cyclical" },
  { symbol: "SBUX", name: "Starbucks Corporation", exchange: "NASDAQ", sector: "Consumer Cyclical" },
  { symbol: "TGT", name: "Target Corporation", exchange: "NYSE", sector: "Consumer Defensive" },
  { symbol: "COST", name: "Costco Wholesale Corporation", exchange: "NASDAQ", sector: "Consumer Defensive" },
  
  // Entertainment & Media
  { symbol: "DIS", name: "Walt Disney Company", exchange: "NYSE", sector: "Communication Services" },
  { symbol: "NFLX", name: "Netflix Inc.", exchange: "NASDAQ", sector: "Communication Services" },
  { symbol: "CMCSA", name: "Comcast Corporation", exchange: "NASDAQ", sector: "Communication Services" },
  
  // Industrial & Energy
  { symbol: "XOM", name: "Exxon Mobil Corporation", exchange: "NYSE", sector: "Energy" },
  { symbol: "CVX", name: "Chevron Corporation", exchange: "NYSE", sector: "Energy" },
  { symbol: "BA", name: "Boeing Company", exchange: "NYSE", sector: "Industrials" },
  { symbol: "CAT", name: "Caterpillar Inc.", exchange: "NYSE", sector: "Industrials" },
  
  // Telecom
  { symbol: "T", name: "AT&T Inc.", exchange: "NYSE", sector: "Communication Services" },
  { symbol: "VZ", name: "Verizon Communications Inc.", exchange: "NYSE", sector: "Communication Services" },
  
  // Software & Cloud
  { symbol: "CRM", name: "Salesforce Inc.", exchange: "NYSE", sector: "Technology" },
  { symbol: "ORCL", name: "Oracle Corporation", exchange: "NYSE", sector: "Technology" },
  { symbol: "ADBE", name: "Adobe Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "CSCO", name: "Cisco Systems Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "IBM", name: "International Business Machines", exchange: "NYSE", sector: "Technology" },
  
  // Semiconductors
  { symbol: "AVGO", name: "Broadcom Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "QCOM", name: "Qualcomm Inc.", exchange: "NASDAQ", sector: "Technology" },
  { symbol: "TXN", name: "Texas Instruments Inc.", exchange: "NASDAQ", sector: "Technology" },
  
  // E-commerce & Payments
  { symbol: "PYPL", name: "PayPal Holdings Inc.", exchange: "NASDAQ", sector: "Financial Services" },
  { symbol: "SQ", name: "Block Inc. (Square)", exchange: "NYSE", sector: "Financial Services" },
  { symbol: "SHOP", name: "Shopify Inc.", exchange: "NYSE", sector: "Technology" },
  
  // Electric Vehicles & Clean Energy
  { symbol: "RIVN", name: "Rivian Automotive Inc.", exchange: "NASDAQ", sector: "Automotive" },
  { symbol: "LCID", name: "Lucid Group Inc.", exchange: "NASDAQ", sector: "Automotive" },
  { symbol: "NIO", name: "NIO Inc.", exchange: "NYSE", sector: "Automotive" },
  
  // Aerospace & Defense
  { symbol: "LMT", name: "Lockheed Martin Corporation", exchange: "NYSE", sector: "Industrials" },
  { symbol: "RTX", name: "Raytheon Technologies Corp.", exchange: "NYSE", sector: "Industrials" },
  
  // Cryptocurrency Related
  { symbol: "COIN", name: "Coinbase Global Inc.", exchange: "NASDAQ", sector: "Financial Services" },
  
  // Social Media & Communication
  { symbol: "SNAP", name: "Snap Inc.", exchange: "NYSE", sector: "Communication Services" },
  { symbol: "PINS", name: "Pinterest Inc.", exchange: "NYSE", sector: "Communication Services" },
  { symbol: "TWTR", name: "Twitter Inc.", exchange: "NYSE", sector: "Communication Services" },
  
  // Gaming
  { symbol: "EA", name: "Electronic Arts Inc.", exchange: "NASDAQ", sector: "Communication Services" },
  { symbol: "ATVI", name: "Activision Blizzard Inc.", exchange: "NASDAQ", sector: "Communication Services" },
  { symbol: "RBLX", name: "Roblox Corporation", exchange: "NYSE", sector: "Communication Services" },
  
  // Biotech
  { symbol: "GILD", name: "Gilead Sciences Inc.", exchange: "NASDAQ", sector: "Healthcare" },
  { symbol: "MRNA", name: "Moderna Inc.", exchange: "NASDAQ", sector: "Healthcare" },
  { symbol: "BNTX", name: "BioNTech SE", exchange: "NASDAQ", sector: "Healthcare" },
];

// Search function for autocomplete
export function searchStocks(query: string): StockOption[] {
  if (!query || query.trim().length === 0) {
    return POPULAR_STOCKS.slice(0, 10); // Return top 10 if no query
  }
  
  const searchTerm = query.toLowerCase().trim();
  
  return POPULAR_STOCKS.filter(stock => 
    stock.symbol.toLowerCase().includes(searchTerm) ||
    stock.name.toLowerCase().includes(searchTerm)
  ).slice(0, 10); // Limit to 10 results
}
