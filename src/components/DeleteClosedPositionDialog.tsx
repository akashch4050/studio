
"use client";

import React, { useState, useActionState, useEffect, startTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { z } from "zod";

import { deleteClosedPosition } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface DeleteClosedPositionDialogProps {
  positionId: string;
  positionName: string;
}

const DeleteClosedPositionSchema = z.object({
  id: z.string().min(1),
});

function SubmitDeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Confirm Delete
    </Button>
  );
}

export function DeleteClosedPositionDialog({ positionId, positionName }: DeleteClosedPositionDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const [initialState, setInitialState] = useState<{ message: string | null; errors?: { id?: string[] } }>({ message: null });
  const [state, formAction] = useActionState(deleteClosedPosition, initialState);

  useEffect(() => {
    if (state?.message?.startsWith('Successfully deleted')) {
      toast({
        title: "Success",
        description: state.message,
      });
      setOpen(false);
      setInitialState({ message: null }); // Reset state for next interaction
    } else if (state?.message || state?.errors) {
      toast({
        title: "Error",
        description: state.message || state.errors?.id?.[0] || "Failed to delete position.",
        variant: "destructive",
      });
       setInitialState({ message: null }); // Reset state
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, toast]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('id', positionId); // Ensure the ID is correctly set

    const validatedFields = DeleteClosedPositionSchema.safeParse({ id: positionId });
    if (!validatedFields.success) {
        toast({
            title: "Error",
            description: "Invalid position ID.",
            variant: "destructive",
        });
        return;
    }
    startTransition(() => {
        formAction(formData);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete {positionName}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this position?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will permanently remove the closed position for <strong>{positionName}</strong>. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setInitialState({ message: null })}>Cancel</AlertDialogCancel>
          <form onSubmit={handleSubmit}>
            <input type="hidden" name="id" value={positionId} />
            <SubmitDeleteButton />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
