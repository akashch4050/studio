"use client";

import { useEffect, useState, useCallback } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
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
  buyDate: z.date({ required_error: "Buy date is required."}),
  buyPrice: z.coerce.number().positive("Buy price must be a positive number"),
  targetPrice: z.coerce.number().positive("Target price must be positive").optional().or(z.literal('')),
  quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
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
  const [initialState, setInitialState] = useState({ message: null, errors: {} });
  const [state, formAction] = useFormState(addStockPurchase, initialState);
  
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stockNameQuery, setStockNameQuery] = useState("");

  const form = useForm<AddStockFormValues>({
    resolver: zodResolver(AddStockFormSchema),
    defaultValues: {
      name: "",
      buyDate: new Date(),
      buyPrice: undefined,
      targetPrice: undefined,
      quantity: undefined,
    },
  });

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length > 1) {
      const result = await getStockSuggestions(query);
      setSuggestions(result);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (stockNameQuery) {
      const debounceTimer = setTimeout(() => {
        fetchSuggestions(stockNameQuery);
      }, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [stockNameQuery, fetchSuggestions]);

  useEffect(() => {
    if (state?.message?.startsWith('Added')) {
      toast({
        title: "Success!",
        description: state.message,
      });
      form.reset();
      setStockNameQuery(""); // Reset stock name query
      setInitialState({ message: null, errors: {} }); // Reset form state for next submission
    } else if (state?.message && state?.errors) { // Check if there are errors in the state
       toast({
        title: "Error",
        description: "Please check the form for errors.",
        variant: "destructive",
      });
    }
  }, [state, toast, form]);


  const handleStockNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    form.setValue("name", query);
    setStockNameQuery(query);
  };

  const handleSuggestionClick = (suggestion: StockSuggestion) => {
    form.setValue("name", suggestion.name);
    setStockNameQuery(suggestion.name);
    setSuggestions([]);
    setShowSuggestions(false);
  };
  
  const handleSubmit = (data: AddStockFormValues) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('buyDate', format(data.buyDate, "yyyy-MM-dd"));
    formData.append('buyPrice', data.buyPrice.toString());
    if (data.targetPrice) {
      formData.append('targetPrice', data.targetPrice.toString());
    }
    formData.append('quantity', data.quantity.toString());
    formAction(formData);
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
            value={stockNameQuery}
            onChange={handleStockNameChange}
            onFocus={() => stockNameQuery && fetchSuggestions(stockNameQuery)} // Show suggestions on focus if query exists
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} // Delay to allow click
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
        {state?.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
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
              {form.watch("buyDate") ? format(form.watch("buyDate"), "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={form.watch("buyDate")}
              onSelect={(date) => form.setValue("buyDate", date || new Date() )}
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
          {state?.errors?.buyPrice && <p className="text-sm text-destructive">{state.errors.buyPrice[0]}</p>}
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
      
      {state?.message && !state.message.startsWith('Added') && <p className="text-sm text-destructive text-center">{state.message}</p>}


      <SubmitButton />
    </form>
  );
}
