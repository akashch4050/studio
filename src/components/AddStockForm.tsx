
"use client";

import { useEffect, useState, useCallback, useActionState, startTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Search } from "lucide-react";

import { addStockPurchase, getStockSuggestions } from '@/app/actions';
import type { StockSuggestion } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const AddStockFormSchema = z.object({
  name: z.string().min(1, "Stock name is required"),
  buyDate: z.date({ required_error: "Buy date is required."}).optional(),
  targetPrice: z.coerce.number().positive("Target price must be positive").optional().or(z.literal('')),
  quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
  buyPrice: z.coerce.number().positive("Buy price must be a positive number"),
});

type AddStockFormValues = z.infer<typeof AddStockFormSchema>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Add Stock
    </Button>
  );
}

export function AddStockForm() {
  const { toast } = useToast();
  const [initialState, setInitialState] = useState<{ message: string | null; errors?: { [key: string]: string[] | undefined } | null }>({ message: null, errors: {} });
  const [state, formAction] = useActionState(addStockPurchase, initialState);
  
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const form = useForm<AddStockFormValues>({
    resolver: zodResolver(AddStockFormSchema),
    defaultValues: {
      name: "",
      buyDate: undefined,
      buyPrice: undefined,
      targetPrice: undefined,
      quantity: undefined,
    },
  });

  useEffect(() => {
    if (form.getValues('buyDate') === undefined) {
      form.setValue("buyDate", new Date(), {
        shouldValidate: false, 
        shouldDirty: true // Mark as dirty so it's included in submission if unchanged by user
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.setValue, form.getValues]);


  const watchedStockName = form.watch("name");

  const fetchSuggestions = useCallback(async (query: string) => {
    const result = await getStockSuggestions(query);
    setSuggestions(result);
    setShowSuggestions(result.length > 0);
  }, []);

  useEffect(() => {
    if (watchedStockName && watchedStockName.length > 1) {
      const debounceTimer = setTimeout(() => {
        fetchSuggestions(watchedStockName);
      }, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [watchedStockName, fetchSuggestions]);

  useEffect(() => {
    if (state?.message?.startsWith('Added')) {
      toast({
        title: "Success!",
        description: state.message,
      });
      form.reset({
        name: "",
        buyDate: new Date(),
        buyPrice: undefined,
        targetPrice: undefined,
        quantity: undefined,
      });
      setInitialState({ message: null, errors: {} }); 
    } else if (state?.message || state?.errors && Object.keys(state.errors).length > 0) { 
       toast({
        title: "Error",
        description: state.message || "Please check the form for errors.",
        variant: "destructive",
      });
       Object.keys(state.errors || {}).forEach(key => {
        const fieldKey = key as keyof AddStockFormValues;
        const errorMessages = state.errors?.[fieldKey];
        if (errorMessages && errorMessages.length > 0) {
          form.setError(fieldKey, { type: 'server', message: errorMessages[0] });
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, toast]);


  const handleSuggestionClick = (suggestion: StockSuggestion) => {
    form.setValue("name", suggestion.name, { shouldValidate: true });
    setSuggestions([]);
    setShowSuggestions(false);
  };
  
  const handleSubmit = (data: AddStockFormValues) => {
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.buyDate) {
        formData.append('buyDate', format(data.buyDate, "yyyy-MM-dd"));
    } else {
        formData.append('buyDate', format(new Date(), "yyyy-MM-dd"));
    }
    formData.append('buyPrice', data.buyPrice.toString());
    if (data.targetPrice !== '' && data.targetPrice !== undefined) {
      formData.append('targetPrice', data.targetPrice.toString());
    }
    formData.append('quantity', data.quantity.toString());
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="relative space-y-2">
        <Label htmlFor="name">Stock Name</Label>
         <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="name"
            placeholder="e.g. Apple Inc."
            {...form.register("name")}
            onFocus={() => {
              const currentName = form.getValues("name");
              if (currentName && currentName.length > 1) {
                fetchSuggestions(currentName);
              }
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className={cn("pl-10", form.formState.errors.name || state?.errors?.name ? "border-destructive" : "")}
            autoComplete="off"
          />
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
            {suggestions.map((s, index) => (
              <li
                key={index}
                className="px-3 py-2 hover:bg-secondary cursor-pointer text-sm"
                onClick={() => handleSuggestionClick(s)}
              >
                {s.name} ({s.symbol})
              </li>
            ))}
          </ul>
        )}
        {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
        {!form.formState.errors.name && state?.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="buyDate">Buy Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !form.watch("buyDate") && "text-muted-foreground",
                form.formState.errors.buyDate || state?.errors?.buyDate ? "border-destructive" : ""
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {form.watch("buyDate") ? format(form.watch("buyDate") as Date, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={form.watch("buyDate")}
              onSelect={(date) => form.setValue("buyDate", date || new Date(), { shouldValidate: true })}
              initialFocus
              disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
            />
          </PopoverContent>
        </Popover>
        {form.formState.errors.buyDate && <p className="text-sm text-destructive">{form.formState.errors.buyDate.message}</p>}
         {state?.errors?.buyDate && <p className="text-sm text-destructive">{state.errors.buyDate[0]}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="buyPrice">Buy Price per Share</Label>
          <Input
            id="buyPrice"
            type="number"
            step="0.01"
            placeholder="e.g. 150.25"
            {...form.register("buyPrice")}
            className={form.formState.errors.buyPrice || state?.errors?.buyPrice ? "border-destructive" : ""}
          />
          {form.formState.errors.buyPrice && <p className="text-sm text-destructive">{form.formState.errors.buyPrice.message}</p>}
          {state?.errors?.buyPrice && <p className
="text-sm text-destructive">{state.errors.buyPrice[0]}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            step="1"
            placeholder="e.g. 10"
            {...form.register("quantity")}
            className={form.formState.errors.quantity || state?.errors?.quantity ? "border-destructive" : ""}
          />
          {form.formState.errors.quantity && <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>}
          {state?.errors?.quantity && <p className="text-sm text-destructive">{state.errors.quantity[0]}</p>}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="targetPrice">Target Price per Share (Optional)</Label>
        <Input
          id="targetPrice"
          type="number"
          step="0.01"
          placeholder="e.g. 200.00"
          {...form.register("targetPrice")}
           className={form.formState.errors.targetPrice || state?.errors?.targetPrice ? "border-destructive" : ""}
        />
        {form.formState.errors.targetPrice && <p className="text-sm text-destructive">{form.formState.errors.targetPrice.message}</p>}
        {state?.errors?.targetPrice && <p className="text-sm text-destructive">{state.errors.targetPrice[0]}</p>}
      </div>
      
      {state?.message && !state.message.startsWith('Added') && (!state.errors || Object.keys(state.errors).length === 0) && <p className="text-sm text-destructive text-center">{state.message}</p>}

      <SubmitButton />
    </form>
  );
}

    