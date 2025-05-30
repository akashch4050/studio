
import { getPortfolioWithDetails } from '@/app/actions';
import { PortfolioItemCard } from '@/components/PortfolioItemCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PackageOpen } from 'lucide-react';
import Link from 'next/link';

export default async function PortfolioPage() {
  const portfolio = await getPortfolioWithDetails();

  const totalPortfolioValue = portfolio.reduce((sum, item) => sum + item.currentValue, 0);
  const totalInvestmentValue = portfolio.reduce((sum, item) => sum + (item.buyPrice * item.quantity), 0);
  const overallGainLoss = totalPortfolioValue - totalInvestmentValue;
  const overallGainLossPercent = totalInvestmentValue > 0 ? (overallGainLoss / totalInvestmentValue) * 100 : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-semibold">
              ₹{totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Investment</p>
            <p className="text-2xl font-semibold">
              ₹{totalInvestmentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overall P&amp;L</p>
            <p className={`text-2xl font-semibold ${overallGainLoss >= 0 ? 'text-accent' : 'text-destructive'}`}>
              {overallGainLoss >= 0 ? '+' : ''}₹{overallGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overall P&amp;L %</p>
            <p className={`text-2xl font-semibold ${overallGainLossPercent >= 0 ? 'text-accent' : 'text-destructive'}`}>
              {overallGainLossPercent >= 0 ? '+' : ''}{overallGainLossPercent.toFixed(2)}%
            </p>
          </div>
        </CardContent>
      </Card>

      {portfolio.length === 0 ? (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <div className="mx-auto bg-secondary p-4 rounded-full w-fit">
              <PackageOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle className="mt-4 text-xl font-headline">Your portfolio is empty</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Start by adding your first stock purchase.
            </p>
            <Button asChild>
              <Link href="/add-stock">Add New Stock</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolio.map((item) => (
            <PortfolioItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
