import React, { useState, useEffect } from "react";
import { useNostrContext } from "../../contexts/NostrContext";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { NDKEvent } from "@nostr-dev-kit/ndk";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "../../hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { GroupInfo } from "../../services/nip29";

// Import with type assertions to avoid TypeScript errors
import * as nip29 from "../../services/nip29";
const fetchGroups = nip29.fetchGroups;
const joinGroup = nip29.joinGroup;

export function GroupList() {
  const { ndk, userPubkey } = useNostrContext();
  const { toast } = useToast();
  const [joiningGroup, setJoiningGroup] = useState<string | null>(null);

  // Fetch groups the user is a member of
  const { data: memberGroups, isLoading: loadingMemberships } = useQuery({
    queryKey: ["group-memberships", userPubkey],
    queryFn: async () => {
      if (!ndk || !userPubkey) return [];
      console.log("Fetching user memberships...");
      
      const events = await ndk.fetchEvents({
        kinds: [9021], // Group membership events
        authors: [userPubkey],
      });

      console.log(`Found ${events.size} membership events`);
      
      const memberships: string[] = [];
      events.forEach((event: NDKEvent) => {
        // Extract group ID from the event
        const groupId = event.tags.find((tag: string[]) => tag[0] === "e")?.[1];
        if (groupId) {
          memberships.push(groupId);
        }
      });
      
      console.log(`User is a member of ${memberships.length} groups: ${memberships.join(', ')}`);
      return memberships;
    },
    enabled: !!ndk && !!userPubkey,
  });

  // Fetch all available groups
  const { 
    data: groups, 
    isLoading: loadingGroups,
    refetch: refetchGroups
  } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      if (!ndk) {
        console.log("NDK not available, cannot fetch groups");
        return [];
      }
      
      console.log("Fetching all groups...");
      const result = await fetchGroups(ndk);
      return result;
    },
    enabled: !!ndk,
  });

  // Handle joining a group
  const handleJoinGroup = async (groupId: string) => {
    if (!ndk || !userPubkey) {
      toast({
        title: "Error",
        description: "You need to be connected to Nostr to join a group",
        variant: "destructive",
      });
      return;
    }

    setJoiningGroup(groupId);
    try {
      console.log(`Joining group: ${groupId}`);
      await joinGroup(ndk, groupId);
      toast({
        title: "Success",
        description: "You have joined the group!",
      });
      // Refresh the memberships
      refetchGroups();
    } catch (error) {
      toast({
        title: "Failed to join group",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setJoiningGroup(null);
    }
  };

  // Check if user is a member of a group
  const isMember = (groupId: string): boolean => {
    return memberGroups?.includes(groupId) || false;
  };

  useEffect(() => {
    // Print group information for debugging
    if (groups && groups.length > 0) {
      console.log(`Displaying ${groups.length} groups:`, 
        groups.map((g: GroupInfo) => ({ id: g.id, name: g.name }))
      );
    }
  }, [groups]);

  if (loadingGroups || loadingMemberships) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="pb-2">
                <Skeleton className="h-20 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups && groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group: GroupInfo) => (
            <Card key={group.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={group.picture} alt={group.name} />
                    <AvatarFallback>
                      {group.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl">{group.name}</CardTitle>
                    <CardDescription className="text-xs">
                      Created {formatDistanceToNow(group.createdAt * 1000)} ago
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                  {group.about}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                {isMember(group.id) ? (
                  <div className="flex items-center gap-2 w-full">
                    <Badge variant="secondary">Member</Badge>
                    <Button asChild variant="default" className="ml-auto">
                      <Link href={`/groups/${group.id}`}>View Group</Link>
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleJoinGroup(group.id)}
                    disabled={joiningGroup === group.id}
                    className="w-full"
                  >
                    {joiningGroup === group.id ? "Joining..." : "Join Group"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center p-4">
              <h3 className="text-lg font-medium">No groups available</h3>
              <p className="text-sm text-gray-500 mb-4">
                There are no diet tracking groups available yet. Be the first to create one!
              </p>
              <Button asChild>
                <Link href="/groups/new">Create a Group</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}