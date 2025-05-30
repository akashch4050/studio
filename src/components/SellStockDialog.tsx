
"use client";

import React, { useState, useActionState, useEffect, startTransition } from 'react';
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
  sellDate: z.date({ required_error: "Sell date is required." }).optional(),
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
  const [initialState, setInitialState] = useState<{ message: string | null; errors?: { [key: string]: string[] | undefined } | null }>({ message: null, errors: {} });
  const [state, formAction] = useActionState(recordSale, initialState);


  const form = useForm<SellStockFormValues>({
    resolver: zodResolver(SellStockFormSchema),
    defaultValues: {
      stockId: stock.id,
      sellDate: undefined, 
      sellPrice: stock.currentPrice || undefined,
    },
  });
  
  useEffect(() => {
    if (open) {
        form.reset({ // Reset form when dialog opens or stock details change
            stockId: stock.id,
            sellDate: new Date(), // Default to today
            sellPrice: stock.currentPrice || undefined,
        });
        // Clear previous server action state as well
        setInitialState({ message: null, errors: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stock.id, stock.currentPrice, form.reset]);


  const onSubmit = (data: SellStockFormValues) => {
    const formData = new FormData();
    formData.append('stockId', data.stockId);
    if (data.sellDate) {
        formData.append('sellDate', format(data.sellDate, "yyyy-MM-dd"));
    } else {
        formData.append('sellDate', format(new Date(), "yyyy-MM-dd"));
    }
    formData.append('sellPrice', data.sellPrice.toString());
    
    startTransition(() => {
      formAction(formData);
    });
  };
  
  useEffect(() => {
    if (state?.message?.startsWith('Sold')) {
      toast({
        title: "Success",
        description: state.message,
      });
      setOpen(false);
      // Form is reset by the 'open' useEffect when dialog reopens
    } else if (state?.message || (state?.errors && Object.keys(state.errors).length > 0)) { 
       toast({
        title: "Error",
        description: state.message || "Failed to record sale. Please check the details.",
        variant: "destructive",
      });
      Object.keys(state.errors || {}).forEach(key => {
        const fieldKey = key as keyof SellStockFormValues;
        const errorMessages = state.errors?.[fieldKey];
        if (errorMessages && errorMessages.length > 0) {
          form.setError(fieldKey, { type: 'server', message: errorMessages[0] });
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, toast]);


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
                  onSelect={(date) => form.setValue("sellDate", date || new Date(), {shouldValidate: true})}
                  initialFocus
                  disabled={(date) => date > new Date() || date < new Date(stock.buyDate)}
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.sellDate && <p className="text-sm text-destructive">{form.formState.errors.sellDate.message}</p>}
            {state?.errors?.sellDate && <p className="text-sm text-destructive">{state.errors.sellDate[0]}</p>}
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
            {state?.errors?.sellPrice && <p className="text-sm text-destructive">{state.errors.sellPrice[0]}</p>}
          </div>
           {state?.message && !state.message.startsWith('Sold') && (!state.errors || Object.keys(state.errors).length === 0) && <p className="text-sm text-destructive text-center">{state.message}</p>}
          
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    