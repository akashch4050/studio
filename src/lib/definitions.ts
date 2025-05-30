export interface StockPurchase {
  id: string;
  name: string;
  buyDate: string; // ISO string date
  buyPrice: number;
  targetPrice: number;
  quantity: number;
}

export interface PortfolioItem extends StockPurchase {
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  daysSinceBuy: number;
  remainingGain?: number; // Optional as target may not be set or met
  portfolioWeightage?: number; // Optional, calculated dynamically
}

export interface ClosedPosition {
  id: string;
  name: string;
  buyDate: string; // ISO string date
  buyPrice: number;
  quantity: number;
  buyValue: number;
  sellDate: string; // ISO string date
  sellPrice: number;
  sellValue: number;
  gain: number;
  daysHeld: number;
  percentGain: number;
  annualizedGainPercent?: number; // Optional
}

export interface StockSuggestion {
  name: string;
  symbol: string;
}
