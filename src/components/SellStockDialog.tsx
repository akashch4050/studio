
"use client";

import React, { useState, useActionState, useEffect } from 'react'; // Added useEffect
import { useFormStatus } from 'react-dom';
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
  sellDate: z.date({ required_error: "Sell date is required." }).optional(), // Optional to allow undefined initial state
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
      sellDate: undefined, // Initialize as undefined
      sellPrice: stock.currentPrice || undefined,
    },
  });
  
  useEffect(() => {
    // Set default date on client-side after hydration
    if (form.getValues('sellDate') === undefined) {
        form.setValue("sellDate", new Date(), {
            shouldValidate: false,
            shouldDirty: false
        });
    }
    // Reset sellPrice when dialog is opened or stock changes, to reflect current market price as default
    // This ensures that if the user reopens the dialog for the same stock or a different stock,
    // the sellPrice field defaults to the latest currentPrice.
    // We need to be careful if this runs too often, e.g., on every render.
    // This should ideally run when `stock.currentPrice` changes or `open` becomes true.
    if (open) {
        form.setValue("sellPrice", stock.currentPrice || undefined, {
            shouldValidate: false, // Or true if you want to validate the new default
            shouldDirty: false 
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stock.currentPrice, form.setValue, form.getValues]); // Rerun if dialog opens or current price changes


  const [state, formAction] = useActionState(recordSale, { message: null, errors: {} });

  const onSubmit = (data: SellStockFormValues) => {
    const formData = new FormData();
    formData.append('stockId', data.stockId);
    if (data.sellDate) { // Ensure sellDate is not undefined
        formData.append('sellDate', format(data.sellDate, "yyyy-MM-dd"));
    } else {
        // Fallback or error if sellDate is still undefined
        formData.append('sellDate', format(new Date(), "yyyy-MM-dd"));
    }
    formData.append('sellPrice', data.sellPrice.toString());
    
    formAction(formData);
  };
  
  React.useEffect(() => {
    if (state?.message?.startsWith('Sold')) {
      toast({
        title: "Success",
        description: state.message,
      });
      setOpen(false);
      form.reset({ 
          stockId: stock.id, 
          sellDate: new Date(), // Client-side new Date for reset is fine
          sellPrice: stock.currentPrice || undefined,
      });
    } else if (state?.message) { 
       toast({
        title: "Error",
        description: state.message,
        variant: "destructive",
      });
    }
    if (state?.errors) {
      console.error("Validation errors:", state.errors);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, toast, form, stock.id, stock.currentPrice]);


  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) { // When dialog closes, reset form to its initial default state or specific defaults
            form.reset({
                stockId: stock.id,
                sellDate: new Date(), // Default to new Date() for next open
                sellPrice: stock.currentPrice || undefined,
            });
        } else {
            // When dialog opens, ensure date is set if it was undefined.
            // The main useEffect with [open, stock.currentPrice] dependency also handles this.
             if (form.getValues('sellDate') === undefined) {
                form.setValue("sellDate", new Date(), {
                    shouldValidate: false,
                    shouldDirty: false
                });
            }
        }
    }}>
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
                    !form.watch("sellDate") && "text-muted-foreground",
                     form.formState.errors.sellDate || state?.errors?.sellDate ? "border-destructive" : ""
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch("sellDate") ? format(form.watch("sellDate") as Date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={form.watch("sellDate")}
                  onSelect={(date) => form.setValue("sellDate", date || new Date())}
                  initialFocus
                  disabled={(date) => date > new Date() || date < new Date(stock.buyDate)}
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.sellDate && <p className="text-sm text-destructive">{form.formState.errors.sellDate.message}</p>}
            {state?.errors?.sellDate && <p className="text-sm text-destructive">{(state.errors.sellDate as string[])[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sellPrice">Sell Price per Share</Label>
            <Input
              id="sellPrice"
              type="number"
              step="0.01"
              {...form.register("sellPrice")}
              className={form.formState.errors.sellPrice || state?.errors?.sellPrice ? "border-destructive" : ""}
            />
            {form.formState.errors.sellPrice && <p className="text-sm text-destructive">{form.formState.errors.sellPrice.message}</p>}
            {state?.errors?.sellPrice && <p className="text-sm text-destructive">{(state.errors.sellPrice as string[])[0]}</p>}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
