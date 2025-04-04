import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNostrContext } from "../../contexts/NostrContext";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { CreateGroupParams } from "../../services/nip29";

// Import with type assertions to avoid TypeScript errors
import * as nip29 from "../../services/nip29";
const createGroup = nip29.createGroup;

// Schema for group creation form
const formSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters"),
  about: z.string().min(10, "Description must be at least 10 characters"),
  picture: z.string().url("Must be a valid URL").optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

export function GroupCreator() {
  const { ndk, userPubkey } = useNostrContext();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  // Set up form with default values
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      about: "",
      picture: "",
    },
  });

  // Set up mutation for creating a group
  const createGroupMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!ndk || !userPubkey) {
        throw new Error("Nostr connection not available");
      }
      setIsCreating(true);
      console.log("Creating group with data:", data);
      
      // Only include picture if it's a non-empty string
      const groupParams: CreateGroupParams = {
        name: data.name,
        about: data.about,
      };
      
      if (data.picture) {
        groupParams.picture = data.picture;
      }
      
      const result = await createGroup(ndk, groupParams);
      console.log("Group created successfully:", result);
      return result;
    },
    onSuccess: (data) => {
      setIsCreating(false);
      toast({
        title: "Group created!",
        description: `Successfully created group "${data.name}"`,
      });
      form.reset();
    },
    onError: (error: Error) => {
      console.error("Failed to create group:", error);
      setIsCreating(false);
      toast({
        title: "Failed to create group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: FormData) => {
    createGroupMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a New Group</CardTitle>
        <CardDescription>
          Create a new diet tracking group to collaborate with friends and family
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Diet Group" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="about"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell people what your group is about..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="picture"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Picture URL (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://example.com/image.jpg" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isCreating || createGroupMutation.isPending}
            >
              {isCreating || createGroupMutation.isPending
                ? "Creating Group..."
                : "Create Group"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}