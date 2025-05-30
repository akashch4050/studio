
import { getClosedPositions } from '@/app/actions';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Archive, PackageOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DeleteClosedPositionDialog } from '@/components/DeleteClosedPositionDialog';

export default async function ClosedPositionsPage() {
  const closedPositions = await getClosedPositions();

  return (
    <div className="space-y-8 animate-fade-in">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Archive className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl font-headline">Closed Positions</CardTitle>
          </div>
          <CardDescription>Review your past stock sales and performance.</CardDescription>
        </CardHeader>
        <CardContent>
          {closedPositions.length === 0 ? (
            <div className="text-center py-12">
               <div className="mx-auto bg-secondary p-4 rounded-full w-fit mb-4">
                 <PackageOpen className="h-12 w-12 text-muted-foreground" />
               </div>
              <h3 className="text-xl font-semibold mb-2">No Closed Positions Yet</h3>
              <p className="text-muted-foreground">Once you sell stocks from your portfolio, they will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Buy Date</TableHead>
                    <TableHead className="text-right">Buy Rate</TableHead>
                    <TableHead className="text-right">Buy Value</TableHead>
                    <TableHead>Sell Date</TableHead>
                    <TableHead className="text-right">Sell Price</TableHead>
                    <TableHead className="text-right">Sell Value</TableHead>
                    <TableHead className="text-right">Gain</TableHead>
                    <TableHead className="text-right">Days Held</TableHead>
                    <TableHead className="text-right">% Gain</TableHead>
                    <TableHead className="text-right">% Annual Gain</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedPositions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell className="font-medium">{pos.name}</TableCell>
                      <TableCell className="text-right">{pos.quantity}</TableCell>
                      <TableCell>{new Date(pos.buyDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">${pos.buyPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${pos.buyValue.toFixed(2)}</TableCell>
                      <TableCell>{new Date(pos.sellDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">${pos.sellPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${pos.sellValue.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-semibold ${pos.gain >= 0 ? 'text-accent' : 'text-destructive'}`}>
                        {pos.gain >= 0 ? '+' : ''}${pos.gain.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{pos.daysHeld}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={pos.percentGain >= 0 ? "default" : "destructive"} className={pos.percentGain >=0 ? "bg-accent/20 text-accent border-accent/30" : "bg-destructive/20 text-destructive border-destructive/30"}>
                           {pos.percentGain.toFixed(2)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                         {pos.annualizedGainPercent !== undefined ? `${pos.annualizedGainPercent.toFixed(2)}%` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        <DeleteClosedPositionDialog positionId={pos.id} positionName={pos.name} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                 {closedPositions.length > 5 && <TableCaption>A list of your closed stock positions.</TableCaption>}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
