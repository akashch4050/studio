import type { PortfolioItem } from '@/lib/definitions';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, CalendarDays, Percent, Layers } from 'lucide-react';
import { SellStockDialog } from './SellStockDialog';
import { Badge } from './ui/badge';

interface PortfolioItemCardProps {
  item: PortfolioItem;
}

export function PortfolioItemCard({ item }: PortfolioItemCardProps) {
  const gainLossColor = item.gainLoss >= 0 ? 'text-accent' : 'text-destructive';
  const gainLossIcon = item.gainLoss >= 0 ? <TrendingUp className="h-4 w-4 text-accent" /> : <TrendingDown className="h-4 w-4 text-destructive" />;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col animate-slide-in-up">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-headline">{item.name}</CardTitle>
            <CardDescription>Bought on: {new Date(item.buyDate).toLocaleDateString()}</CardDescription>
          </div>
          <Badge variant={item.gainLoss >= 0 ? "default" : "destructive"} className={item.gainLoss >=0 ? "bg-accent/20 text-accent border-accent/30" : "bg-destructive/20 text-destructive border-destructive/30"}>
            {item.gainLossPercent.toFixed(2)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex-grow">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span>Qty: {item.quantity}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span>Days Held: {item.daysSinceBuy}</span>
          </div>
          <div>Buy Price: ${item.buyPrice.toFixed(2)}</div>
          <div>Current Price: ${item.currentPrice.toFixed(2)}</div>
          <div>Investment: ${(item.buyPrice * item.quantity).toFixed(2)}</div>
          <div>Current Value: ${item.currentValue.toFixed(2)}</div>
        </div>
        
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">P&L:</span>
            <span className={`font-semibold flex items-center gap-1 ${gainLossColor}`}>
              {gainLossIcon}
              {item.gainLoss >= 0 ? '+' : ''}${item.gainLoss.toFixed(2)} ({item.gainLossPercent.toFixed(2)}%)
            </span>
          </div>
          {item.targetPrice > 0 && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="font-medium flex items-center gap-1"><Target className="h-4 w-4 text-primary" />Target:</span>
              <span className="font-semibold">${item.targetPrice.toFixed(2)}</span>
            </div>
          )}
          {item.remainingGain !== undefined && item.remainingGain > 0 && (
             <div className="flex items-center justify-between text-sm mt-1">
             <span className="font-medium">To Target:</span>
             <span className="font-semibold text-primary">+${item.remainingGain.toFixed(2)}</span>
           </div>
          )}
           {item.portfolioWeightage !== undefined && (
            <div className="flex items-center justify-between text-sm mt-1">
                <span className="font-medium flex items-center gap-1"><Percent className="h-4 w-4 text-primary" />Weight:</span>
                <span className="font-semibold">{item.portfolioWeightage.toFixed(2)}%</span>
            </div>
        )}
        </div>
      </CardContent>
      <CardFooter>
        <SellStockDialog stock={item} />
      </CardFooter>
    </Card>
  );
}
