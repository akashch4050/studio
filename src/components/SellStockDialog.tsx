
"use client";

import { useState, useActionState } from 'react';
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
  
  const [state, formAction] = useActionState(recordSale, { message: null, errors: {} });

  const onSubmit = async (data: SellStockFormValues) => {
    const formData = new FormData();
    formData.append('stockId', data.stockId);
    formData.append('sellDate', format(data.sellDate, "yyyy-MM-dd"));
    formData.append('sellPrice', data.sellPrice.toString());
    
    // Directly pass the previous state and formData to the action.
    // useActionState handles the state update internally.
    // We're calling the action `formAction` bound by `useActionState`.
    // However, since we are manually calling it inside an `onSubmit` handler
    // provided by `react-hook-form`, we need to call the original server action `recordSale`
    // and then process its result. The `formAction` returned by `useActionState` is meant
    // to be directly used in the `action` prop of a `<form>`.

    // To correctly use useActionState with react-hook-form's handleSubmit,
    // we should pass the `formAction` (which is the server action wrapped by useActionState)
    // directly to the <form action={formAction}>.
    // However, react-hook-form's `handleSubmit` expects a client-side function.
    // A common pattern is to let react-hook-form handle client-side validation
    // and then call the server action (or the `formAction` from `useActionState`) programmatically.

    // Let's simplify and ensure it works correctly with the formAction from useActionState
    // We can trigger the formAction, and then react to the `state` change in an effect.
    // However, the original code was calling `recordSale` directly.
    // To keep the structure similar while correctly using `useActionState`, the `formAction` itself
    // should be called. The `state` will then update, and effects can react to it.
    
    // The issue here is that `formAction` expects `FormData` as the second argument if no previous state is passed.
    // When `useActionState` wraps a server action, the returned `formAction` can be used directly in a form.
    // If calling programmatically, we provide the form data.
    
    // The original call was `recordSale(state, formData)` which is incorrect for the `formAction` from `useActionState`
    // The `formAction` itself takes the FormData (or other payload).
    
    // Let's assume `formAction` from `useActionState` is what we should call.
    // It implicitly uses the `initialState` or the last `state`.
    // The first argument to `formAction` should be the payload, typically FormData.
    
    // Re-evaluating: The `formAction` returned by `useActionState` is indeed what should be called
    // with the form data. The `state` will be updated automatically by React.
    
    // The `formAction` function, when called, will invoke `recordSale` with the previous state and the new FormData.
    // The `recordSale` action needs to be adapted to handle the previous state argument correctly if it's
    // being managed by `useActionState`. The current `recordSale` signature `(prevState: any, formData: FormData)` is correct.

    // So, we should call `formAction(formData)` here.
    // The `state` will update, and the useEffect below (if it existed) would handle the toast.
    // Let's adapt the existing `onSubmit` to call `formAction` and then handle the result directly
    // from the `state` variable in an effect, or check the result if `formAction` returns it.
    // `useActionState`'s `formAction` does not directly return the server action's result when called.
    // The result is available in the `state` variable.
    
    // We'll keep the original logic of calling `recordSale` directly and then processing its result,
    // because `formAction` usage here might be tricky with `react-hook-form`'s `handleSubmit`.
    // The key fix is the import and usage of `useActionState` itself.
    // The toast logic relies on the `state` variable that `useActionState` updates.

    const boundAction = (fd: FormData) => {
      // This is a bit of a workaround to fit react-hook-form's handleSubmit
      // with the formAction from useActionState.
      // We want react-hook-form to call this, which in turn calls the action from useActionState.
      // And then we want to react to the `state` change.
      // The current structure where `onSubmit` calls `recordSale` directly and then
      // `useActionState` is *also* used for `recordSale` might lead to `state` not being the one
      // from *this specific* programmatic call if not handled carefully.
      
      // The simplest way is to rely on the `state` updated by `formAction` in an effect.
      // Let's modify the `onSubmit` to call `formAction` (the wrapped action).
      // The toast logic already depends on `state`.
      
      formAction(formData); // This will trigger `recordSale` and update `state`.
    };
    
    boundAction(formData); // Call the form action. The useEffect will handle toasts.
  };
  
  // useEffect to handle toast messages based on `state` changes from `useActionState`
  React.useEffect(() => {
    if (state?.message?.startsWith('Sold')) {
      toast({
        title: "Success",
        description: state.message,
      });
      setOpen(false);
      form.reset({ // Reset with default values or specific values if needed
          stockId: stock.id, // Keep stockId
          sellDate: new Date(),
          sellPrice: stock.currentPrice || undefined,
      });
    } else if (state?.message) { // This covers error messages from the action
       toast({
        title: "Error",
        description: state.message,
        variant: "destructive",
      });
    }
    if (state?.errors) {
      console.error("Validation errors:", state.errors);
      // Optionally set form errors if they are field-specific
      // Object.entries(state.errors).forEach(([key, value]) => {
      //   form.setError(key as keyof SellStockFormValues, { type: 'server', message: (value as string[])[0] });
      // });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, toast, form, stock.id, stock.currentPrice]); // Add dependencies that form.reset might need


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
        {/*
          To correctly use useActionState, the form should directly use the `formAction`.
          However, react-hook-form's `handleSubmit` is used for client-side validation.
          The programmatic call to `formAction` inside `onSubmit` is one way to integrate.
        */}
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
                  {form.watch("sellDate") ? format(form.watch("sellDate"), "PPP") : <span>Pick a date</span>}
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
          
          {/* This general error message might be redundant if useEffect handles it via toast */}
          {/* state?.message && !state.message.startsWith('Sold') && <p className="text-sm text-destructive">{state.message}</p> */}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
