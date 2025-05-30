import { AddStockForm } from '@/components/AddStockForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AddStockPage() {
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Add New Stock Purchase</CardTitle>
          <CardDescription>
            Enter the details of your stock purchase to add it to your portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddStockForm />
        </CardContent>
      </Card>
    </div>
  );
}
