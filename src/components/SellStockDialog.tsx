"use client";

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";

import { recordSale } from '@/app/actions';
import type { PortfolioItem } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SellStockDialogProps {
  stock: PortfolioItem;
}

const SellStockFormSchema = z.object({
  stockId: z.string(),
  sellDate: z.date({ required_error: "Sell date is required." }),
  sellPrice: z.coerce.number().positive("Sell price must be positive."),
});

type SellStockFormValues = z.infer<typeof SellStockFormSchema>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Record Sale
    </Button>
  );
}

export function SellStockDialog({ stock }: SellStockDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<SellStockFormValues>({
    resolver: zodResolver(SellStockFormSchema),
    defaultValues: {
      stockId: stock.id,
      sellDate: new Date(),
      sellPrice: stock.currentPrice || undefined,
    },
  });
  
  const [state, formAction] = useFormState(recordSale, { message: null, errors: {} });

  const onSubmit = async (data: SellStockFormValues) => {
    const formData = new FormData();
    formData.append('stockId', data.stockId);
    formData.append('sellDate', format(data.sellDate, "yyyy-MM-dd"));
    formData.append('sellPrice', data.sellPrice.toString());
    
    const result = await recordSale(state, formData); // Call server action directly
    
    if (result?.message?.startsWith('Sold')) {
      toast({
        title: "Success",
        description: result.message,
      });
      setOpen(false);
      form.reset();
    } else if (result?.message) {
       toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
    }
     if (result?.errors) {
      // Handle field errors if necessary, e.g. by setting form errors
      // For now, just log them or show a generic error
      console.error("Validation errors:", result.errors);
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">Sell Stock</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sell {stock.name}</DialogTitle>
          <DialogDescription>
            Record the sale of {stock.quantity} shares of {stock.name}. Current price: ${stock.currentPrice.toFixed(2)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("stockId")} />
          
          <div className="space-y-2">
            <Label htmlFor="sellDate">Sell Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !form.watch("sellDate") && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch("sellDate") ? format(form.watch("sellDate"), "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={form.watch("sellDate")}
                  onSelect={(date) => form.setValue("sellDate", date || new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.sellDate && <p className="text-sm text-destructive">{form.formState.errors.sellDate.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sellPrice">Sell Price per Share</Label>
            <Input
              id="sellPrice"
              type="number"
              step="0.01"
              {...form.register("sellPrice")}
              className={form.formState.errors.sellPrice ? "border-destructive" : ""}
            />
            {form.formState.errors.sellPrice && <p className="text-sm text-destructive">{form.formState.errors.sellPrice.message}</p>}
          </div>
          
          {state?.message && !state.message.startsWith('Sold') && <p className="text-sm text-destructive">{state.message}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
