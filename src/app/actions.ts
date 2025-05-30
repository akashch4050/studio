
"use server";

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { differenceInDays } from 'date-fns';
import type { StockPurchase, ClosedPosition, PortfolioItem } from '@/lib/definitions';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'Data');
const ACTIVE_STOCK_CSV_PATH = path.join(DATA_DIR, 'Active_Stock.csv');
const CLOSED_POSITIONS_CSV_PATH = path.join(DATA_DIR, 'Closed_Positions.csv');
const STOCK_NAMES_CSV_PATH = path.join(DATA_DIR, 'Stock_Name.csv'); // New CSV for stock names

const GOOGLE_SHEET_URL_PLACEHOLDER = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRMjtSRxkcX_Tmc_ru9O7xPxaymgKPDiy_tThfBwklQbDP6JjCDTxSN-OaXS6P6Dqits72O7k8GQKAz/pub?gid=0&single=true&output=csv";

const ACTIVE_STOCK_HEADERS = 'id,name,buyDate,buyPrice,targetPrice,quantity';
const CLOSED_POSITION_HEADERS = 'id,name,buyDate,buyPrice,quantity,buyValue,sellDate,sellPrice,sellValue,gain,daysHeld,percentGain,annualizedGainPercent';
const STOCK_NAMES_HEADERS = 'name'; // Headers for the new CSV

const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;

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
    if (lines.length === 0) { // Handle completely empty file
        await fs.writeFile(filePath, headers + '\n', 'utf-8'); // Ensure headers exist
        return [];
    }
    if (lines[0].trim() !== headers) {
        console.warn(`Headers mismatch or missing in ${filePath}. Expected: "${headers}", Found: "${lines[0].trim()}". Overwriting with correct headers.`);
        await fs.writeFile(filePath, headers + '\n', 'utf-8');
        return [];
    }
    if (lines.length <= 1) { // Only headers or empty after headers
        return [];
    }
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return parser(values);
    }).filter((item): item is T => item !== null);
  } catch (error) {
    // If file doesn't exist or other read error, create it with headers
    console.warn(`Error reading ${filePath}, ensuring it exists with headers. Error: ${error}`);
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

// Parser and stringifier for Stock_Name.csv
const parseStockNameEntry = (row: string[]): { name: string } | null => {
  return row[0] ? { name: row[0].trim() } : null;
};

const stringifyStockNameEntry = (item: { name: string }): string => item.name;


async function fetchGoogleSheetCsvData(): Promise<string> {
  try {
    const response = await fetch(GOOGLE_SHEET_URL_PLACEHOLDER, { next: { revalidate: 300 } }); // Revalidate every 5 minutes for direct use
    if (!response.ok) {
      console.error(`Failed to fetch Google Sheet: ${response.status} ${response.statusText}. URL: ${GOOGLE_SHEET_URL_PLACEHOLDER}`);
      return ""; // Return empty string on fetch failure
    }
    const csvText = await response.text();
    return csvText;
  } catch (error) {
    console.error("Error fetching Google Sheet data:", error);
    return ""; // Return empty string on exception
  }
}

async function updateStockNamesCsvIfNeeded(): Promise<void> {
  await ensureDataDirExists();
  try {
    let needsUpdate = false;
    try {
      const stats = await fs.stat(STOCK_NAMES_CSV_PATH);
      if (Date.now() - stats.mtime.getTime() > FIVE_MINUTES_IN_MS) {
        needsUpdate = true;
      }
    } catch (e) { // File doesn't exist
      needsUpdate = true;
    }

    if (!needsUpdate) {
      // console.log("Stock_Name.csv is up-to-date.");
      return;
    }

    console.log("Stock_Name.csv needs update. Fetching from Google Sheet...");
    const csvText = await fetchGoogleSheetCsvData();

    if (!csvText) {
      console.warn("Stock_Name.csv update: Failed to fetch Google Sheet data. Local CSV will not be updated.");
      return; // Do not update local CSV if fetch failed
    }

    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) { // Needs at least header and one data line
      console.warn("Stock_Name.csv update: Google Sheet CSV is empty or contains only headers. Writing empty Stock_Name.csv.");
      await writeCsvFile(STOCK_NAMES_CSV_PATH, [], STOCK_NAMES_HEADERS, stringifyStockNameEntry);
      return;
    }

    const headersFromSheet = lines[0].split(',').map(h => h.trim());
    const nameHeaderIndex = headersFromSheet.indexOf('name');

    if (nameHeaderIndex === -1) {
      console.error("Stock_Name.csv update: 'name' column not found in Google Sheet. Local CSV will not be updated.");
      return;
    }

    const stockNameObjects = lines.slice(1)
      .map(line => {
        const values = line.split(',');
        const name = values[nameHeaderIndex]?.trim();
        return name ? { name } : null;
      })
      .filter((item): item is { name: string } => item !== null && item.name !== '');
    
    const uniqueStockNameObjects = Array.from(new Set(stockNameObjects.map(s => s.name))).map(name => ({ name }));

    await writeCsvFile(STOCK_NAMES_CSV_PATH, uniqueStockNameObjects, STOCK_NAMES_HEADERS, stringifyStockNameEntry);
    console.log(`Stock_Name.csv updated successfully with ${uniqueStockNameObjects.length} unique names.`);

  } catch (error) {
    console.error("Error in updateStockNamesCsvIfNeeded:", error);
  }
}


async function getParsedGoogleSheetData(): Promise<Array<Record<string, string>>> {
  const csvText = await fetchGoogleSheetCsvData();
  if (!csvText) {
    // console.warn("No CSV text fetched from Google Sheet for getParsedGoogleSheetData.");
    return [];
  }

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    // console.warn("CSV data from Google Sheet is empty or contains only headers for getParsedGoogleSheetData.");
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
  }).filter(entry => Object.values(entry).some(val => val !== ''));

  if (data.length === 0) {
    // console.warn("No valid data rows found after parsing Google Sheet CSV for getParsedGoogleSheetData.");
  }
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
  await ensureDataDirExists();
  await updateStockNamesCsvIfNeeded(); // Ensure local stock names CSV is up-to-date

  const localStockNameEntries = await readCsvFile(STOCK_NAMES_CSV_PATH, STOCK_NAMES_HEADERS, parseStockNameEntry);
  const validStockNamesFromCsv = localStockNameEntries.map(entry => entry.name);
  
  if (validStockNamesFromCsv.length === 0) {
     return {
      errors: { name: ["Could not load stock list from local cache (Stock_Name.csv). Please try again later or check configuration."] },
      message: 'Failed to validate stock name. Data loading issue from local stock name cache.',
    };
  }

  if (!validStockNamesFromCsv.includes(data.name)) {
    return {
      errors: { name: ["Please select a valid stock from the suggestions list. The stock name is not found in the local stock name cache."] },
      message: 'Invalid stock name. It does not match any stock in the local cache.',
    };
  }
  
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

  // For current prices, we still fetch directly from Google Sheet to ensure they are fresh.
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
          // console.warn(`Could not parse price for ${name}: ${priceStr}. Using 0.`);
          stockPriceMap.set(name, 0);
        }
      } else if (name) {
        //  console.warn(`Current_Price not found for ${name} in Google Sheet. Using 0.`);
         stockPriceMap.set(name, 0);
      }
    });
  } else {
      // console.warn("No data fetched from Google Sheet for current prices. Current prices will be 0 for all stocks.");
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
  const percentGain = buyValue > 0 ? (gain / buyValue) * 100 : (sellValue > 0 ? Infinity : 0);

  let annualizedGainPercent: number | undefined = undefined;
  if (daysHeld > 0 && buyValue > 0) {
    annualizedGainPercent = (percentGain / daysHeld) * 365;
  } else if (daysHeld === 0 && buyValue > 0 && percentGain !== 0) {
    annualizedGainPercent = percentGain * 365;
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
  return [...closedPositions].sort((a,b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime());
}

export async function getStockSuggestions(query: string): Promise<string[]> {
  if (!query) return [];
  await ensureDataDirExists();
  await updateStockNamesCsvIfNeeded(); // Ensure local stock names CSV is up-to-date

  const nameEntries = await readCsvFile(STOCK_NAMES_CSV_PATH, STOCK_NAMES_HEADERS, parseStockNameEntry);
  
  if (nameEntries.length === 0) {
    // console.warn("No stock data from local Stock_Name.csv to provide suggestions.");
    return [];
  }

  const suggestions: string[] = nameEntries
    .map(entry => entry.name)
    .filter((name): name is string =>
      !!name && name.toLowerCase().includes(query.toLowerCase())
    );
  
  if (suggestions.length === 0) {
    // console.warn(`No stock name suggestions found for query: "${query}" from local cache.`);
  }
  return suggestions.slice(0, 10);
}

