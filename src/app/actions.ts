
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

// TODO: Replace this mock data by fetching and parsing data from the Google Sheet URL below.
// For example, you might publish your Google Sheet as a CSV and fetch it.
const GOOGLE_SHEET_URL_PLACEHOLDER = "YOUR_GOOGLE_SHEET_LINK_HERE";

const GOOGLE_SHEET_CSV_DATA = `Stock Name,Symbol
Reliance Industries,RELIANCE
Tata Consultancy Services,TCS
HDFC Bank,HDFCBANK
Infosys,INFY
ICICI Bank,ICICIBANK
Hindustan Unilever,HINDUNILVR
State Bank of India,SBIN
Bajaj Finance,BAJFINANCE
Bharti Airtel,BHARTIARTL
Kotak Mahindra Bank,KOTAKBANK
Advanced Micro Devices,AMD
NVIDIA Corporation,NVDA
Apple Inc.,AAPL
Microsoft Corporation,MSFT
Alphabet Inc. (Google),GOOGL
Amazon.com Inc.,AMZN
Tesla Inc.,TSLA
Meta Platforms Inc.,META
`;

const validStockNamesFromSheet = GOOGLE_SHEET_CSV_DATA
  .split('\n')
  .slice(1) // Skip header
  .map(line => {
    const [name] = line.split(',');
    return name?.trim();
  })
  .filter((name): name is string => !!name); // Type guard to filter out undefined/empty and ensure string array

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

  // Validate if the stock name is from the predefined list
  if (!validStockNamesFromSheet.includes(data.name)) {
    return {
      errors: {
        ...validatedFields.error.flatten().fieldErrors, // Preserve other errors
        name: ["Please select a valid stock from the suggestions list."],
      },
      message: 'Invalid stock name provided.',
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
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const suggestions: StockSuggestion[] = GOOGLE_SHEET_CSV_DATA
    .split('\n')
    .slice(1) // Skip header
    .map(line => {
      const [name, symbol] = line.split(',');
      return { name: name?.trim(), symbol: symbol?.trim() };
    })
    .filter((stock): stock is StockSuggestion => !!(stock.name && stock.symbol && stock.name.toLowerCase().includes(query.toLowerCase()))); // Type guard
    
  return suggestions.slice(0, 10); // Limit suggestions
}

