
"use server";

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { differenceInDays } from 'date-fns';
import type { StockPurchase, ClosedPosition, StockSuggestion, PortfolioItem } from '@/lib/definitions';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'Data');
const ACTIVE_STOCK_CSV_PATH = path.join(DATA_DIR, 'Active_Stock.csv');
const CLOSED_POSITIONS_CSV_PATH = path.join(DATA_DIR, 'Closed_Positions.csv');

const GOOGLE_SHEET_URL_PLACEHOLDER = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRMjtSRxkcX_Tmc_ru9O7xPxaymgKPDiy_tThfBwklQbDP6JjCDTxSN-OaXS6P6Dqits72O7k8GQKAz/pub?gid=0&single=true&output=csv";
let fetchedGoogleSheetCsvData: string | null = null;
let parsedGoogleSheetDataCache: Array<Record<string, string>> | null = null;

const ACTIVE_STOCK_HEADERS = 'id,name,buyDate,buyPrice,targetPrice,quantity';
const CLOSED_POSITION_HEADERS = 'id,name,buyDate,buyPrice,quantity,buyValue,sellDate,sellPrice,sellValue,gain,daysHeld,percentGain,annualizedGainPercent';

async function ensureDataDirExists(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function readCsvFile<T>(filePath: string, headers: string, parser: (row: string[]) => T | null): Promise<T[]> {
  try {
    await fs.access(filePath);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const lines = fileContent.trim().split('\n');
    if (lines.length <= 1 || lines[0].trim() !== headers) {
      // If headers don't match or only header exists, consider it empty or create with headers
      if (lines.length === 0 || lines[0].trim() !== headers) {
        await fs.writeFile(filePath, headers + '\n', 'utf-8');
      }
      return [];
    }
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return parser(values);
    }).filter((item): item is T => item !== null);
  } catch (error) {
    // If file does not exist, create it with headers
    await fs.writeFile(filePath, headers + '\n', 'utf-8');
    return [];
  }
}

async function writeCsvFile<T>(filePath: string, data: T[], headers: string, stringifier: (item: T) => string): Promise<void> {
  const csvContent = [headers, ...data.map(stringifier)].join('\n');
  await fs.writeFile(filePath, csvContent + '\n', 'utf-8');
}

const parseStockPurchase = (row: string[]): StockPurchase | null => {
  if (row.length < 6) return null;
  const [id, name, buyDate, buyPriceStr, targetPriceStr, quantityStr] = row;
  return {
    id,
    name,
    buyDate,
    buyPrice: parseFloat(buyPriceStr) || 0,
    targetPrice: targetPriceStr ? parseFloat(targetPriceStr) : 0,
    quantity: parseInt(quantityStr, 10) || 0,
  };
};

const stringifyStockPurchase = (stock: StockPurchase): string =>
  [stock.id, stock.name, stock.buyDate, stock.buyPrice.toString(), stock.targetPrice?.toString() || '0', stock.quantity.toString()].join(',');

const parseClosedPosition = (row: string[]): ClosedPosition | null => {
  if (row.length < 13) return null;
  const [id, name, buyDate, buyPriceStr, quantityStr, buyValueStr, sellDate, sellPriceStr, sellValueStr, gainStr, daysHeldStr, percentGainStr, annualizedGainPercentStr] = row;
  return {
    id,
    name,
    buyDate,
    buyPrice: parseFloat(buyPriceStr) || 0,
    quantity: parseInt(quantityStr, 10) || 0,
    buyValue: parseFloat(buyValueStr) || 0,
    sellDate,
    sellPrice: parseFloat(sellPriceStr) || 0,
    sellValue: parseFloat(sellValueStr) || 0,
    gain: parseFloat(gainStr) || 0,
    daysHeld: parseInt(daysHeldStr, 10) || 0,
    percentGain: parseFloat(percentGainStr) || 0,
    annualizedGainPercent: annualizedGainPercentStr ? parseFloat(annualizedGainPercentStr) : undefined,
  };
};

const stringifyClosedPosition = (pos: ClosedPosition): string =>
  [
    pos.id, pos.name, pos.buyDate, pos.buyPrice.toString(), pos.quantity.toString(), pos.buyValue.toString(),
    pos.sellDate, pos.sellPrice.toString(), pos.sellValue.toString(), pos.gain.toString(), pos.daysHeld.toString(),
    pos.percentGain.toString(), pos.annualizedGainPercent?.toString() || ''
  ].join(',');

async function ensureGoogleSheetCsvDataFetched(): Promise<string> {
  if (fetchedGoogleSheetCsvData !== null) {
    return fetchedGoogleSheetCsvData;
  }
  try {
    const response = await fetch(GOOGLE_SHEET_URL_PLACEHOLDER, { cache: 'no-store', next: { revalidate: 300 } }); // Revalidate every 5 minutes
    if (!response.ok) {
      console.error(`Failed to fetch Google Sheet: ${response.status} ${response.statusText}`);
      fetchedGoogleSheetCsvData = ""; // Store empty string on failure to prevent retries for a short while
      return "";
    }
    const csvText = await response.text();
    fetchedGoogleSheetCsvData = csvText;
    parsedGoogleSheetDataCache = null; 
    return fetchedGoogleSheetCsvData;
  } catch (error) {
    console.error("Error fetching or parsing Google Sheet data:", error);
    fetchedGoogleSheetCsvData = "";
    return "";
  }
}

async function getParsedGoogleSheetData(): Promise<Array<Record<string, string>>> {
  if (parsedGoogleSheetDataCache) {
    return parsedGoogleSheetDataCache;
  }
  const csvText = await ensureGoogleSheetCsvDataFetched();
  if (!csvText) {
    parsedGoogleSheetDataCache = [];
    return [];
  }

  const lines = csvText.trim().split(/\r?\n/); // Handles both LF and CRLF line endings
  if (lines.length < 2) { 
    parsedGoogleSheetDataCache = [];
    return [];
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const data = lines.slice(1).map(line => {
    const values = line.split(',');
    const entry: Record<string, string> = {};
    headers.forEach((header, index) => {
      entry[header] = values[index]?.trim() || '';
    });
    return entry;
  });
  parsedGoogleSheetDataCache = data;
  return data;
}


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
      message: 'Failed to add stock. Please check the form for errors.',
    };
  }

  const data = validatedFields.data;
  const googleSheetStocks = await getParsedGoogleSheetData();

  if (googleSheetStocks.length === 0) {
     return {
      errors: { name: ["Could not load stock list from Google Sheet. Please check sheet configuration or try again later."] },
      message: 'Failed to validate stock name. Data loading issue from Google Sheet.',
    };
  }
  
  const validStockNamesFromSheet = googleSheetStocks
    .map(stockData => stockData['name']) 
    .filter((name): name is string => !!name);

  if (!validStockNamesFromSheet.includes(data.name)) {
    return {
      errors: { name: ["Please select a valid stock from the suggestions list. The stock name is not found in the linked Google Sheet."] },
      message: 'Invalid stock name. It does not match any stock in the Google Sheet.',
    };
  }
  
  await ensureDataDirExists();
  const portfolio = await readCsvFile<StockPurchase>(ACTIVE_STOCK_CSV_PATH, ACTIVE_STOCK_HEADERS, parseStockPurchase);

  const newStock: StockPurchase = {
    id: Date.now().toString(),
    name: data.name,
    buyDate: data.buyDate,
    buyPrice: data.buyPrice,
    targetPrice: data.targetPrice || 0,
    quantity: data.quantity,
  };
  portfolio.push(newStock);
  await writeCsvFile<StockPurchase>(ACTIVE_STOCK_CSV_PATH, portfolio, ACTIVE_STOCK_HEADERS, stringifyStockPurchase);
  
  revalidatePath('/');
  revalidatePath('/add-stock');
  return { message: `Added ${data.name} to portfolio.` };
}


export async function getPortfolioWithDetails(): Promise<PortfolioItem[]> {
  await ensureDataDirExists();
  const portfolio = await readCsvFile<StockPurchase>(ACTIVE_STOCK_CSV_PATH, ACTIVE_STOCK_HEADERS, parseStockPurchase);
  
  const googleSheetStocks = await getParsedGoogleSheetData();
  const stockPriceMap = new Map<string, number>();
  if (googleSheetStocks.length > 0) {
    googleSheetStocks.forEach(stockData => {
      const name = stockData['name']; 
      const priceStr = stockData['Current_Price']; 
      if (name && priceStr) {
        const price = parseFloat(priceStr);
        if (!isNaN(price)) {
          stockPriceMap.set(name, price);
        } else {
          console.warn(`Could not parse price for ${name}: ${priceStr}. Using 0.`);
          stockPriceMap.set(name, 0);
        }
      } else if (name) {
        console.warn(`Current_Price not found for ${name}. Using 0.`);
        stockPriceMap.set(name, 0);
      }
    });
  } else {
      console.warn("No data fetched from Google Sheet. Current prices will be 0.");
  }
  
  const detailedPortfolio: PortfolioItem[] = [];
  let totalPortfolioValue = 0;

  for (const stock of portfolio) {
    const currentPrice = stockPriceMap.get(stock.name) || 0; 
    const currentValue = currentPrice * stock.quantity;
    const buyValue = stock.buyPrice * stock.quantity;
    const gainLoss = currentValue - buyValue;
    const gainLossPercent = buyValue > 0 ? (gainLoss / buyValue) * 100 : 0;
    const daysSinceBuy = differenceInDays(new Date(), new Date(stock.buyDate));
    
    let remainingGain: number | undefined = undefined;
    if (stock.targetPrice && stock.targetPrice > 0 && stock.targetPrice > currentPrice) {
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
      message: 'Failed to record sale. Please check the form details.',
    };
  }
  
  const { stockId, sellDate, sellPrice } = validatedFields.data;
  
  await ensureDataDirExists();
  let portfolio = await readCsvFile<StockPurchase>(ACTIVE_STOCK_CSV_PATH, ACTIVE_STOCK_HEADERS, parseStockPurchase);
  const stockIndex = portfolio.findIndex(s => s.id === stockId);

  if (stockIndex === -1) {
    return { message: 'Stock not found in portfolio.' };
  }

  const stockToSell = portfolio[stockIndex];
  const buyValue = stockToSell.buyPrice * stockToSell.quantity;
  const sellValue = sellPrice * stockToSell.quantity;
  const gain = sellValue - buyValue;
  const daysHeld = differenceInDays(new Date(sellDate), new Date(stockToSell.buyDate));
  const percentGain = buyValue > 0 ? (gain / buyValue) * 100 : (sellValue > 0 ? Infinity : 0); // Handle 0 buyValue
  
  let annualizedGainPercent: number | undefined = undefined;
  if (daysHeld > 0 && buyValue > 0) {
    annualizedGainPercent = (percentGain / daysHeld) * 365;
  } else if (daysHeld === 0 && buyValue > 0 && percentGain !== 0) { // Same day sale with gain/loss
    annualizedGainPercent = percentGain * 365; // Simplistic annualization for same-day
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

  let closedPositions = await readCsvFile<ClosedPosition>(CLOSED_POSITIONS_CSV_PATH, CLOSED_POSITION_HEADERS, parseClosedPosition);
  closedPositions.push(closedPosition);
  await writeCsvFile<ClosedPosition>(CLOSED_POSITIONS_CSV_PATH, closedPositions, CLOSED_POSITION_HEADERS, stringifyClosedPosition);

  portfolio.splice(stockIndex, 1);
  await writeCsvFile<StockPurchase>(ACTIVE_STOCK_CSV_PATH, portfolio, ACTIVE_STOCK_HEADERS, stringifyStockPurchase);

  revalidatePath('/');
  revalidatePath('/closed-positions');
  return { message: `Sold ${stockToSell.name}. Position moved to closed.` };
}

export async function getClosedPositions(): Promise<ClosedPosition[]> {
  await ensureDataDirExists();
  const closedPositions = await readCsvFile<ClosedPosition>(CLOSED_POSITIONS_CSV_PATH, CLOSED_POSITION_HEADERS, parseClosedPosition);
  // Sort by sellDate descending
  return [...closedPositions].sort((a,b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime());
}

export async function getStockSuggestions(query: string): Promise<StockSuggestion[]> {
  if (!query) return [];
  
  const googleSheetStocks = await getParsedGoogleSheetData();
  if (googleSheetStocks.length === 0) {
    console.warn("Could not fetch stock suggestions from Google Sheet or sheet is empty.");
    return [];
  }
  
  const suggestions: StockSuggestion[] = googleSheetStocks
    .map(stockData => {
      const name = stockData['name']; 
      const symbol = stockData['symbol']; 
      if (name && symbol) {
        return { name, symbol };
      }
      return null;
    })
    .filter((stock): stock is StockSuggestion => 
      !!(stock && stock.name && stock.symbol && stock.name.toLowerCase().includes(query.toLowerCase()))
    );
    
  return suggestions.slice(0, 10); // Return top 10 matches
}


    