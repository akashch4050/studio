
"use server";

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { differenceInDays, formatISO } from 'date-fns';
import type { StockPurchase, ClosedPosition, StockSuggestion, PortfolioItem } from '@/lib/definitions';

// Simulate CSV data storage (in-memory arrays)
let portfolio: StockPurchase[] = [
  // { id: '1', name: 'Sample Stock A', buyDate: '2023-01-15', buyPrice: 100, targetPrice: 150, quantity: 10 },
  // { id: '2', name: 'Sample Stock B', buyDate: '2023-03-10', buyPrice: 200, targetPrice: 250, quantity: 5 },
];
let closedPositions: ClosedPosition[] = [
  // { id: '3', name: 'Old Stock C', buyDate: '2022-05-01', buyPrice: 50, quantity: 20, buyValue: 1000, sellDate: '2022-12-01', sellPrice: 75, sellValue: 1500, gain: 500, daysHeld: 214, percentGain: 50, annualizedGainPercent: 85.28 }
];

// This URL should contain the link to your published Google Sheet CSV.
const GOOGLE_SHEET_URL_PLACEHOLDER = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRMjtSRxkcX_Tmc_ru9O7xPxaymgKPDiy_tThfBwklQbDP6JjCDTxSN-OaXS6P6Dqits72O7k8GQKAz/pub?gid=0&single=true&output=csv";

let fetchedGoogleSheetCsvData: string | null = null;

async function ensureGoogleSheetCsvDataFetched(): Promise<string> {
  if (fetchedGoogleSheetCsvData !== null) {
    return fetchedGoogleSheetCsvData;
  }
  try {
    const response = await fetch(GOOGLE_SHEET_URL_PLACEHOLDER, { cache: 'no-store' }); // Fetch fresh data
    if (!response.ok) {
      console.error(`Failed to fetch Google Sheet: ${response.status} ${response.statusText}`);
      fetchedGoogleSheetCsvData = ""; // Mark as fetched (empty) to avoid retrying constantly on permanent errors
      return "";
    }
    const csvText = await response.text();
    fetchedGoogleSheetCsvData = csvText;
    return fetchedGoogleSheetCsvData;
  } catch (error) {
    console.error("Error fetching or parsing Google Sheet data:", error);
    fetchedGoogleSheetCsvData = ""; // Mark as fetched (empty) to avoid retrying
    return "";
  }
}

// Schemas for validation
const StockPurchaseSchema = z.object({
  name: z.string().min(1, "Stock name is required"),
  buyDate: z.string().min(1, "Buy date is required"),
  buyPrice: z.coerce.number().positive("Buy price must be positive"),
  targetPrice: z.coerce.number().positive("Target price must be positive").optional(),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
});

const SellStockSchema = z.object({
  stockId: z.string().min(1),
  sellDate: z.string().min(1, "Sell date is required"),
  sellPrice: z.coerce.number().positive("Sell price must be positive"),
});


export async function addStockPurchase(prevState: any, formData: FormData) {
  const validatedFields = StockPurchaseSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to add stock.',
    };
  }

  const data = validatedFields.data;

  const csvData = await ensureGoogleSheetCsvDataFetched();
  if (!csvData) {
    return {
      errors: { name: ["Could not load stock list from Google Sheet. Please try again later."] },
      message: 'Failed to validate stock name due to data loading issue from Google Sheet.',
    };
  }

  const validStockNamesFromSheet = csvData
    .split('\n')
    .slice(1) // Skip header
    .map(line => {
      const [name] = line.split(',');
      return name?.trim();
    })
    .filter((name): name is string => !!name);

  // Validate if the stock name is from the predefined list
  if (!validStockNamesFromSheet.includes(data.name)) {
    return {
      errors: {
        name: ["Please select a valid stock from the suggestions list. The stock name is not found in the linked Google Sheet."],
      },
      message: 'Invalid stock name provided. It does not match any stock in the Google Sheet.',
    };
  }

  const newStock: StockPurchase = {
    id: Date.now().toString(), // Simple unique ID
    name: data.name,
    buyDate: data.buyDate, // Assuming date is already ISO string from picker
    buyPrice: data.buyPrice,
    targetPrice: data.targetPrice || 0, // Default if not provided
    quantity: data.quantity,
  };
  portfolio.push(newStock);
  revalidatePath('/');
  revalidatePath('/add-stock');
  return { message: `Added ${data.name} to portfolio.` };
}

// Mock function to get current price
async function getMockCurrentPrice(stockName: string): Promise<number> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  // Generate a somewhat realistic price fluctuation around a base
  const basePrice = stockName.length * 10 + Math.random() * 50;
  const fluctuation = (Math.random() - 0.5) * 20; // +/- 10
  return Math.max(10, parseFloat((basePrice + fluctuation).toFixed(2))); // Ensure price is positive
}


export async function getPortfolioWithDetails(): Promise<PortfolioItem[]> {
  const detailedPortfolio: PortfolioItem[] = [];
  let totalPortfolioValue = 0;

  for (const stock of portfolio) {
    const currentPrice = await getMockCurrentPrice(stock.name);
    const currentValue = currentPrice * stock.quantity;
    const buyValue = stock.buyPrice * stock.quantity;
    const gainLoss = currentValue - buyValue;
    const gainLossPercent = buyValue > 0 ? (gainLoss / buyValue) * 100 : 0;
    const daysSinceBuy = differenceInDays(new Date(), new Date(stock.buyDate));
    
    let remainingGain: number | undefined = undefined;
    if (stock.targetPrice && stock.targetPrice > currentPrice) {
      remainingGain = (stock.targetPrice - currentPrice) * stock.quantity;
    }

    detailedPortfolio.push({
      ...stock,
      currentPrice,
      currentValue,
      gainLoss,
      gainLossPercent,
      daysSinceBuy,
      remainingGain,
    });
    totalPortfolioValue += currentValue;
  }

  // Calculate portfolio weightage
  return detailedPortfolio.map(item => ({
    ...item,
    portfolioWeightage: totalPortfolioValue > 0 ? (item.currentValue / totalPortfolioValue) * 100 : 0,
  }));
}

export async function recordSale(prevState: any, formData: FormData) {
  const validatedFields = SellStockSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to record sale.',
    };
  }
  
  const { stockId, sellDate, sellPrice } = validatedFields.data;
  const stockIndex = portfolio.findIndex(s => s.id === stockId);

  if (stockIndex === -1) {
    return { message: 'Stock not found in portfolio.' };
  }

  const stockToSell = portfolio[stockIndex];
  const buyValue = stockToSell.buyPrice * stockToSell.quantity;
  const sellValue = sellPrice * stockToSell.quantity;
  const gain = sellValue - buyValue;
  const daysHeld = differenceInDays(new Date(sellDate), new Date(stockToSell.buyDate));
  const percentGain = buyValue > 0 ? (gain / buyValue) * 100 : (sellValue > 0 ? Infinity : 0);
  
  let annualizedGainPercent: number | undefined = undefined;
  if (daysHeld > 0 && buyValue > 0) {
    annualizedGainPercent = (percentGain / daysHeld) * 365;
  }


  const closedPosition: ClosedPosition = {
    id: stockToSell.id,
    name: stockToSell.name,
    buyDate: stockToSell.buyDate,
    buyPrice: stockToSell.buyPrice,
    quantity: stockToSell.quantity,
    buyValue,
    sellDate,
    sellPrice,
    sellValue,
    gain,
    daysHeld,
    percentGain,
    annualizedGainPercent,
  };

  closedPositions.push(closedPosition);
  portfolio.splice(stockIndex, 1); // Remove from active portfolio

  revalidatePath('/');
  revalidatePath('/closed-positions');
  return { message: `Sold ${stockToSell.name}. Position moved to closed.` };
}

export async function getClosedPositions(): Promise<ClosedPosition[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return [...closedPositions].sort((a,b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime());
}

export async function getStockSuggestions(query: string): Promise<StockSuggestion[]> {
  if (!query) return [];
  
  const csvData = await ensureGoogleSheetCsvDataFetched();
  if (!csvData) {
    // Optionally, log an error or inform the user that suggestions couldn't be loaded
    console.error("Could not fetch stock suggestions from Google Sheet.");
    return [];
  }
  
  const suggestions: StockSuggestion[] = csvData
    .split('\n')
    .slice(1) // Skip header
    .map(line => {
      const [name, symbol] = line.split(',');
      return { name: name?.trim(), symbol: symbol?.trim() };
    })
    .filter((stock): stock is StockSuggestion => !!(stock.name && stock.symbol && stock.name.toLowerCase().includes(query.toLowerCase())));
    
  return suggestions.slice(0, 10); // Limit suggestions
}

