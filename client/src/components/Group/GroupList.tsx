import React, { useState, useEffect, useCallback } from "react";
import { useNostrContext } from "../../contexts/NostrContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import debounce from "lodash/debounce";
import { Search, Filter, X, Wifi } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";

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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "../../hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { GroupInfo, GroupFilterOptions } from "../../services/nip29";

// Import with type assertions to avoid TypeScript errors
import * as nip29 from "../../services/nip29";
const fetchGroups = nip29.fetchGroups;
const joinGroup = nip29.joinGroup;

interface GroupListProps {
  initialSearchQuery?: string;
}

export function GroupList({ initialSearchQuery = "" }: GroupListProps) {
  const { ndk, userPubkey } = useNostrContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [joiningGroup, setJoiningGroup] = useState<string | null>(null);
  
  // Connect to WebSocket for real-time updates
  const { subscribe, isConnected } = useWebSocket(['group_metadata', 'group_creation', 'group_members']);

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

  // State for search and filtering
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [dietstrOnly, setDietstrOnly] = useState(false); // Changed to false to see all groups by default
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Available tags for filtering
  const availableTags = ["diet", "nutrition", "keto", "vegan", "weightloss"];
  
  // Fetch groups with filtering
  const { 
    data: groups, 
    isLoading: loadingGroups,
    refetch: refetchGroups
  } = useQuery({
    queryKey: ["groups", searchQuery, dietstrOnly, selectedTags],
    queryFn: async () => {
      if (!ndk) {
        console.log("NDK not available, cannot fetch groups");
        return [];
      }
      
      console.log("Fetching groups with filters:", { 
        search: searchQuery, 
        onlyDietstr: dietstrOnly,
        tags: selectedTags.length > 0 ? selectedTags : undefined 
      });
      
      const result = await fetchGroups(ndk, {
        search: searchQuery,
        onlyDietstr: dietstrOnly,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      });
      
      return result;
    },
    enabled: !!ndk,
  });

  // Handle joining a group using useCallback for consistent hook order
  const handleJoinGroup = React.useCallback(async (groupId: string) => {
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
  }, [ndk, userPubkey, toast, refetchGroups]);

  // Check if user is a member of a group (using useCallback for consistent hook order)
  const isMember = React.useCallback((groupId: string): boolean => {
    return memberGroups?.includes(groupId) || false;
  }, [memberGroups]);

  // Update search query when initialSearchQuery prop changes
  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  // Handle WebSocket events for real-time updates
  useEffect(() => {
    if (!isConnected) return;
    
    // Handle group creation events
    const unsubscribeCreate = subscribe('group_created', (data) => {
      console.log('New group created via WebSocket:', data);
      // Invalidate the groups query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    });
    
    // Handle group update events
    const unsubscribeUpdate = subscribe('group_updated', (data) => {
      console.log('Group updated via WebSocket:', data);
      // Invalidate the groups query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    });
    
    // Handle group members update events
    const unsubscribeMembers = subscribe('group_members_updated', (data) => {
      console.log('Group members updated via WebSocket:', data);
      // Invalidate the membership query
      queryClient.invalidateQueries({ queryKey: ['group-memberships'] });
    });
    
    // Clean up subscriptions
    return () => {
      unsubscribeCreate();
      unsubscribeUpdate();
      unsubscribeMembers();
    };
  }, [isConnected, subscribe, queryClient]);

  // Define debounced search handler early in the component
  // to ensure consistent hook order
  const debouncedSearch = React.useCallback(
    debounce((value: string) => {
      setSearchQuery(value);
    }, 300),
    []
  );
  
  // Handle search input change
  const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  }, [debouncedSearch]);
  
  // Handle tag selection with useCallback for consistent hook order
  const handleTagToggle = React.useCallback((tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  }, []);

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
    <div className="space-y-6">
      {/* WebSocket connection status */}
      {isConnected ? (
        <div className="flex items-center gap-2 text-xs text-green-600 mb-1" title="Connected to real-time updates">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <Wifi className="h-4 w-4" />
          <span>Live updates enabled</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1" title="Disconnected from real-time updates">
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          <Wifi className="h-4 w-4" />
          <span>Offline - Group updates may be delayed</span>
        </div>
      )}
      
      {/* Search bar - Always visible */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search groups by name or description..." 
              defaultValue={initialSearchQuery}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => refetchGroups()}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>
        </div>
        
        {/* Filter options always visible */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Switch
              id="diet-only"
              checked={dietstrOnly}
              onCheckedChange={setDietstrOnly}
            />
            <Label htmlFor="diet-only">Only diet-related groups</Label>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm">Tags:</span>
            <div className="flex flex-wrap gap-1">
              {availableTags.map(tag => (
                <Badge 
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer capitalize text-xs"
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
            
            {selectedTags.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 flex items-center gap-1 text-xs p-1"
                onClick={() => setSelectedTags([])}
              >
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Groups display */}
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