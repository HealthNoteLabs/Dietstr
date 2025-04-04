import React, { useState } from "react";
import { useLocation, Route, Switch, Link } from "wouter";
import { useNostrContext } from "../contexts/NostrContext";
import { useGroup } from "../hooks/useGroup";
import { leaveGroup } from "../services/nip29";
import { GroupCreator } from "../components/Group/GroupCreator";
import { GroupList } from "../components/Group/GroupList";
import { Search } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "../hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";

export default function GroupsPage() {
  // Groups router
  return (
    <div className="container mx-auto px-4 py-6">
      <Switch>
        <Route path="/groups" component={GroupListPage} />
        <Route path="/groups/new" component={NewGroupPage} />
        <Route path="/groups/join" component={JoinGroupPage} />
        <Route path="/groups/:id" component={GroupDetailPage} />
      </Switch>
    </div>
  );
}

function GroupListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Diet Groups</h1>
          <p className="text-gray-500">
            Join groups to share your diet journey with others
          </p>
        </div>
        <Button asChild>
          <Link href="/groups/new">Create New Group</Link>
        </Button>
      </header>
      
      {/* Global search bar - directly in the page */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input 
          placeholder="Search for groups by name or description..." 
          className="pl-10 py-6 text-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <GroupList initialSearchQuery={searchTerm} />
    </div>
  );
}

function NewGroupPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Create a New Group</h1>
        <p className="text-gray-500">
          Start a group to track diets and share recipes with friends
        </p>
      </header>

      <GroupCreator />

      <div className="mt-4 text-center">
        <Link href="/groups">
          <Button variant="ghost">Back to Groups</Button>
        </Link>
      </div>
    </div>
  );
}

function JoinGroupPage() {
  const { toast } = useToast();
  const { ndk, userPubkey } = useNostrContext();
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter an invite code",
        variant: "destructive",
      });
      return;
    }

    setJoining(true);
    try {
      // This would handle joining via invite code
      // Currently not implemented in NIP-29
      toast({
        title: "Not Implemented",
        description: "Joining via invite code is not yet implemented",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Join a Group</h1>
        <p className="text-gray-500">
          Enter an invite code to join a private group
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Invite Code</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Enter invite code"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleJoin}
              disabled={joining || !inviteCode.trim()}
            >
              {joining ? "Joining..." : "Join Group"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 text-center">
        <Link href="/groups">
          <Button variant="ghost">Back to Groups</Button>
        </Link>
      </div>
    </div>
  );
}

function GroupDetailPage({ params }: { params: { id: string } }) {
  const [newPost, setNewPost] = useState("");
  const [leavingGroup, setLeavingGroup] = useState(false);
  const { toast } = useToast();
  const { ndk, userPubkey } = useNostrContext();
  const { 
    group, 
    members, 
    isMember,
    isAdmin,
    posting,
    postContent,
    loadingGroup,
    loadingMembers,
    refetchMembers 
  } = useGroup(params.id);

  // Handle leaving a group
  const handleLeaveGroup = async () => {
    if (!ndk || !userPubkey) {
      toast({
        title: "Error",
        description: "You need to be connected to Nostr to leave a group",
        variant: "destructive",
      });
      return;
    }

    setLeavingGroup(true);
    try {
      await leaveGroup(ndk, params.id);
      toast({
        title: "Success",
        description: "You have left the group",
      });
      
      // Force refresh
      refetchMembers();
    } catch (error) {
      toast({
        title: "Failed to leave group",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLeavingGroup(false);
    }
  };

  // Handle submitting a post
  const handlePostSubmit = async () => {
    if (!newPost.trim()) return;

    try {
      await postContent(newPost);
      setNewPost("");
    } catch (error) {
      console.error("Failed to post:", error);
    }
  };

  if (loadingGroup) {
    return (
      <div className="space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </header>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Group Not Found</h2>
        <p className="text-gray-500 mb-6">
          We couldn't find the group you're looking for.
        </p>
        <Button asChild>
          <Link href="/groups">Browse Available Groups</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={group.picture} alt={group.name} />
            <AvatarFallback>
              {group.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{group.name}</h1>
            <p className="text-gray-500">
              Created {formatDistanceToNow(group.createdAt * 1000)} ago
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMember ? (
            <Button
              variant="outline"
              onClick={handleLeaveGroup}
              disabled={leavingGroup}
            >
              {leavingGroup ? "Leaving..." : "Leave Group"}
            </Button>
          ) : (
            <Button disabled>Join</Button>
          )}
          <Link href="/groups">
            <Button variant="ghost">Back to Groups</Button>
          </Link>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>About this Group</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{group.about}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="posts">
        <TabsList className="mb-4">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="members">
            Members ({loadingMembers ? "..." : members?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          {isMember && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>New Post</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Share your diet progress, recipes, or tips with the group..."
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="min-h-[100px]"
                />
              </CardContent>
              <CardFooter className="justify-end">
                <Button
                  onClick={handlePostSubmit}
                  disabled={posting || !newPost.trim()}
                >
                  {posting ? "Posting..." : "Post to Group"}
                </Button>
              </CardFooter>
            </Card>
          )}

          <div className="space-y-4">
            {/* Placeholder for posts */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-center p-6">
                  <h3 className="text-lg font-medium">No posts yet</h3>
                  <p className="text-gray-500 mb-4">
                    Be the first to share something with the group!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Group Members</CardTitle>
              <CardDescription>
                People participating in this diet group
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMembers ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : members && members.length > 0 ? (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div key={member.pubkey} className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {member.pubkey.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {member.pubkey.slice(0, 8)}...
                          {member.role === "admin" && (
                            <Badge variant="secondary">Admin</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          Joined{" "}
                          {formatDistanceToNow(member.addedAt * 1000)} ago
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4">
                  <p>No members found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}