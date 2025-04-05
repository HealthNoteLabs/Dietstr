import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { DailyNote } from "@shared/schema";
import { PencilIcon, SaveIcon, RefreshCw } from "lucide-react";

interface DailyNotesProps {
  userId?: number;
  date: Date;
}

export default function DailyNotes({ userId, date }: DailyNotesProps) {
  const [note, setNote] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query to fetch notes for the selected date
  const {
    data: notes,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['/api/daily-notes', userId, format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(`/api/daily-notes?userId=${userId}&date=${format(date, 'yyyy-MM-dd')}`);
      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }
      return response.json() as Promise<DailyNote[]>;
    },
    enabled: !!userId,
  });

  // Mutation to create a new note
  const createNoteMutation = useMutation({
    mutationFn: async (data: { note: string; userId: number; date: Date }) => {
      const response = await fetch('/api/daily-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note: data.note,
          userId: data.userId,
          date: data.date,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save note');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daily-notes', userId, format(date, 'yyyy-MM-dd')] });
      toast({
        title: "Note saved",
        description: "Your note for this day has been saved successfully.",
      });
      setIsEditing(false);
      setNote("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save your note. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Set existing note content when notes are loaded
  useEffect(() => {
    if (notes && notes.length > 0) {
      // Sort by newest first and take the most recent note
      const sortedNotes = [...notes].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setNote(sortedNotes[0].note);
    } else {
      setNote("");
    }
  }, [notes]);

  // Handle save
  const handleSave = () => {
    if (!userId) return;
    
    createNoteMutation.mutate({
      note: note,
      userId,
      date
    });
  };

  // Handle edit button
  const handleEdit = () => {
    setIsEditing(true);
  };

  // Handle cancel
  const handleCancel = () => {
    if (notes && notes.length > 0) {
      // Reset to the most recent note
      const sortedNotes = [...notes].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setNote(sortedNotes[0].note);
    } else {
      setNote("");
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="animate-spin h-6 w-6 text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center h-32 text-center space-y-2">
            <p className="text-destructive">Failed to load notes</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Daily Notes</span>
          {!isEditing && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleEdit}
              aria-label="Edit note"
            >
              <PencilIcon className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          Record your thoughts, feelings, and observations for {format(date, 'MMMM d, yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How are you feeling today? Note any observations about your diet, energy levels, sleep, etc."
            className="resize-y min-h-[120px]"
          />
        ) : (
          <div className="prose prose-sm max-w-none">
            {notes && notes.length > 0 ? (
              <div className="whitespace-pre-wrap">{note}</div>
            ) : (
              <p className="text-muted-foreground">No notes for this day. Click the edit button to add one.</p>
            )}
          </div>
        )}
      </CardContent>
      {isEditing && (
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={createNoteMutation.isPending || !note.trim()}
          >
            {createNoteMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              <>
                <SaveIcon className="mr-2 h-4 w-4" />
                Save Note
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}