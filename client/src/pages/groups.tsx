import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, UserPlus, Users, Edit, UserMinus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getUserPubkey, initializeNostr, ndk } from '../utils/nostr';
import { useAuth } from '../hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NIP29_EVENT_KINDS } from '@shared/schema';
import NDKEvent from '@nostr-dev-kit/ndk';
import { apiRequest } from '@/lib/queryClient';

// Types for our component
interface NostrGroup {
  id: string;
  name: string;
  about?: string;
  picture?: string;
  members: number;
  isOwner: boolean;
  isMember: boolean;
}

interface GroupMember {
  pubkey: string;
  role: string;
  name?: string;
  picture?: string;
}

export default function GroupsPage() {
  const [, setLocation] = useLocation();
  const { isLoggedIn, login } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [userGroups, setUserGroups] = useState<NostrGroup[]>([]);
  const [publicGroups, setPublicGroups] = useState<NostrGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<NostrGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [selectedTab, setSelectedTab] = useState('my-groups');
  
  // Form state for creating a group
  const [formState, setFormState] = useState({
    name: '',
    about: '',
    picture: ''
  });

  // Load groups when component mounts
  useEffect(() => {
    const loadGroups = async () => {
      if (!isLoggedIn) {
        const loggedIn = await login();
        if (!loggedIn) {
          setLocation('/');
          return;
        }
      }
      
      try {
        setIsLoading(true);
        await fetchGroups();
      } catch (error) {
        console.error('Error loading groups:', error);
        toast({
          title: 'Error',
          description: 'Failed to load groups. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGroups();
  }, [isLoggedIn, login, setLocation]);

  // Fetch groups from the Nostr network
  const fetchGroups = async () => {
    try {
      await initializeNostr();
      if (!ndk) {
        throw new Error('Failed to initialize Nostr connection');
      }
      
      const userPubkey = await getUserPubkey();
      if (!userPubkey) {
        throw new Error('Unable to get user public key');
      }
      
      // Fetch all kind 39000 events (group metadata)
      const groupEvents = await ndk.fetchEvents({
        kinds: [39000],
        limit: 50
      });
      
      console.log(`Fetched ${groupEvents.size} group metadata events`);
      
      // Process the events into group objects
      const processedGroups = await Promise.all(
        Array.from(groupEvents).map(async (event) => {
          // Get group info from the event
          const name = event.tags.find(tag => tag[0] === 'name')?.[1] || 'Unnamed Group';
          const about = event.tags.find(tag => tag[0] === 'about')?.[1] || '';
          const picture = event.tags.find(tag => tag[0] === 'picture')?.[1] || '';
          
          // Fetch members
          const memberEvents = await ndk.fetchEvents({
            kinds: [NIP29_EVENT_KINDS.JOIN_REQUEST],
            '#e': [event.id], // Events referencing this group
            limit: 100
          });
          
          // Check if user is a member
          const isMember = Array.from(memberEvents).some(
            mEvent => mEvent.pubkey === userPubkey
          );
          
          // Check if user is the owner
          const isOwner = event.pubkey === userPubkey;
          
          return {
            id: event.id,
            name,
            about,
            picture,
            members: memberEvents.size,
            isOwner,
            isMember
          };
        })
      );
      
      // Split into user's groups and public groups
      const myGroups = processedGroups.filter(g => g.isMember || g.isOwner);
      const otherGroups = processedGroups.filter(g => !g.isMember && !g.isOwner);
      
      setUserGroups(myGroups);
      setPublicGroups(otherGroups);
      
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch groups from Nostr network',
        variant: 'destructive'
      });
    }
  };

  // Create a new group
  const createGroup = async () => {
    try {
      if (!formState.name.trim()) {
        toast({
          title: 'Error',
          description: 'Group name is required',
          variant: 'destructive'
        });
        return;
      }
      
      // Get user pubkey
      const userPubkey = await getUserPubkey();
      if (!userPubkey) {
        toast({
          title: 'Error',
          description: 'Failed to get your public key',
          variant: 'destructive'
        });
        return;
      }
      
      // Create the group event (kind 39000)
      const groupEvent = {
        kind: 39000,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['name', formState.name],
          ['about', formState.about],
          ['picture', formState.picture]
        ]
      };
      
      // Sign and publish the event
      if (!window.nostr) {
        const loggedIn = await login();
        if (!loggedIn) return;
      }
      
      const signedEvent = await window.nostr?.signEvent(groupEvent);
      if (!signedEvent) {
        throw new Error('Failed to sign group event');
      }
      
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();
      
      // Create a join event for yourself (kind 9021)
      const joinEvent = {
        kind: NIP29_EVENT_KINDS.JOIN_REQUEST,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['e', signedEvent.id],
          ['p', userPubkey],
          ['role', 'owner']
        ]
      };
      
      const signedJoinEvent = await window.nostr?.signEvent(joinEvent);
      if (!signedJoinEvent) {
        throw new Error('Failed to sign join event');
      }
      
      const ndkJoinEvent = new NDKEvent(ndk, signedJoinEvent);
      await ndkJoinEvent.publish();
      
      // Add to the server database
      await apiRequest('/api/groups', {
        method: 'POST',
        data: {
          groupId: signedEvent.id,
          name: formState.name,
          about: formState.about,
          picture: formState.picture
        }
      });
      
      // Reset form and close dialog
      setFormState({ name: '', about: '', picture: '' });
      setShowCreateDialog(false);
      
      // Refresh groups
      await fetchGroups();
      
      toast({
        title: 'Success',
        description: `Group "${formState.name}" created successfully`,
      });
      
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: 'Error',
        description: 'Failed to create group',
        variant: 'destructive'
      });
    }
  };

  // Join a group using invite code
  const joinGroupWithInvite = async () => {
    try {
      if (!inviteCode.trim()) {
        toast({
          title: 'Error',
          description: 'Invite code is required',
          variant: 'destructive'
        });
        return;
      }
      
      // TODO: Implement joining with invite code
      // This would require backend API to validate the invite code
      // and return the group information
      
      toast({
        title: 'Not Implemented',
        description: 'Joining with invite code is not implemented yet',
      });
      
    } catch (error) {
      console.error('Error joining group:', error);
      toast({
        title: 'Error',
        description: 'Failed to join group',
        variant: 'destructive'
      });
    }
  };

  // Join a public group
  const joinGroup = async (group: NostrGroup) => {
    try {
      // Get user pubkey
      const userPubkey = await getUserPubkey();
      if (!userPubkey) {
        toast({
          title: 'Error',
          description: 'Failed to get your public key',
          variant: 'destructive'
        });
        return;
      }
      
      // Create a join event for yourself (kind 9021)
      const joinEvent = {
        kind: NIP29_EVENT_KINDS.JOIN_REQUEST,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['e', group.id],
          ['p', userPubkey],
          ['role', 'member']
        ]
      };
      
      if (!window.nostr) {
        const loggedIn = await login();
        if (!loggedIn) return;
      }
      
      const signedJoinEvent = await window.nostr?.signEvent(joinEvent);
      if (!signedJoinEvent) {
        throw new Error('Failed to sign join event');
      }
      
      const ndkJoinEvent = new NDKEvent(ndk, signedJoinEvent);
      await ndkJoinEvent.publish();
      
      // Refresh groups
      await fetchGroups();
      
      toast({
        title: 'Success',
        description: `Joined group "${group.name}" successfully`,
      });
      
    } catch (error) {
      console.error('Error joining group:', error);
      toast({
        title: 'Error',
        description: 'Failed to join group',
        variant: 'destructive'
      });
    }
  };

  // Leave a group
  const leaveGroup = async (group: NostrGroup) => {
    try {
      // Get user pubkey
      const userPubkey = await getUserPubkey();
      if (!userPubkey) {
        toast({
          title: 'Error',
          description: 'Failed to get your public key',
          variant: 'destructive'
        });
        return;
      }
      
      // Create a leave event (kind 9022)
      const leaveEvent = {
        kind: NIP29_EVENT_KINDS.LEAVE_REQUEST,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['e', group.id],
          ['p', userPubkey]
        ]
      };
      
      if (!window.nostr) {
        const loggedIn = await login();
        if (!loggedIn) return;
      }
      
      const signedLeaveEvent = await window.nostr?.signEvent(leaveEvent);
      if (!signedLeaveEvent) {
        throw new Error('Failed to sign leave event');
      }
      
      const ndkLeaveEvent = new NDKEvent(ndk, signedLeaveEvent);
      await ndkLeaveEvent.publish();
      
      // Refresh groups
      await fetchGroups();
      
      toast({
        title: 'Success',
        description: `Left group "${group.name}" successfully`,
      });
      
    } catch (error) {
      console.error('Error leaving group:', error);
      toast({
        title: 'Error',
        description: 'Failed to leave group',
        variant: 'destructive'
      });
    }
  };

  // View group details
  const viewGroupDetails = async (group: NostrGroup) => {
    try {
      setSelectedGroup(group);
      
      // Fetch members
      await initializeNostr();
      if (!ndk) {
        throw new Error('Failed to initialize Nostr connection');
      }
      
      // Fetch join events for this group
      const memberEvents = await ndk.fetchEvents({
        kinds: [NIP29_EVENT_KINDS.JOIN_REQUEST],
        '#e': [group.id],
        limit: 100
      });
      
      // Process member data
      const members: GroupMember[] = [];
      
      for (const event of memberEvents) {
        const role = event.tags.find(tag => tag[0] === 'role')?.[1] || 'member';
        
        // Try to get profile information
        const profileEvents = await ndk.fetchEvents({
          kinds: [0], // Metadata events
          authors: [event.pubkey],
          limit: 1
        });
        
        let name = event.pubkey.slice(0, 8) + '...';
        let picture = '';
        
        if (profileEvents.size > 0) {
          const profileEvent = Array.from(profileEvents)[0];
          try {
            const profile = JSON.parse(profileEvent.content);
            name = profile.name || profile.display_name || name;
            picture = profile.picture || '';
          } catch (e) {
            console.error('Error parsing profile:', e);
          }
        }
        
        members.push({
          pubkey: event.pubkey,
          role,
          name,
          picture
        });
      }
      
      setGroupMembers(members);
      
    } catch (error) {
      console.error('Error fetching group details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load group details',
        variant: 'destructive'
      });
    }
  };

  // Generate group invite
  const generateInvite = async () => {
    if (!selectedGroup) return;
    
    try {
      // This would typically call an API to generate an invite code
      toast({
        title: 'Not Implemented',
        description: 'Generating invite codes is not implemented yet',
      });
    } catch (error) {
      console.error('Error generating invite:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate invite code',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">Diet Groups</h1>
      
      <Tabs defaultValue="my-groups" className="w-full" onValueChange={setSelectedTab}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="my-groups" className="flex-1">My Groups</TabsTrigger>
          <TabsTrigger value="discover" className="flex-1">Discover Groups</TabsTrigger>
        </TabsList>
        
        {/* My Groups Tab */}
        <TabsContent value="my-groups" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">My Groups</h2>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a New Group</DialogTitle>
                  <DialogDescription>
                    Create a new diet tracking group to collaborate with friends and family.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input 
                      id="group-name" 
                      placeholder="Enter group name" 
                      value={formState.name}
                      onChange={(e) => setFormState({...formState, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-about">Description</Label>
                    <Textarea 
                      id="group-about" 
                      placeholder="Describe your group" 
                      value={formState.about}
                      onChange={(e) => setFormState({...formState, about: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-picture">Picture URL</Label>
                    <Input 
                      id="group-picture" 
                      placeholder="URL for group picture (optional)" 
                      value={formState.picture}
                      onChange={(e) => setFormState({...formState, picture: e.target.value})}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                  <Button onClick={createGroup}>Create Group</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span className="ml-2">Loading groups...</span>
            </div>
          ) : userGroups.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Groups Yet</h3>
              <p className="text-gray-500 mb-4">You haven't joined any groups yet. Create one or join existing groups.</p>
              <div className="flex justify-center gap-4">
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
                <Button variant="outline" onClick={() => setSelectedTab('discover')}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Join Group
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userGroups.map((group) => (
                <Card key={group.id} className="overflow-hidden">
                  <div className="relative h-32 bg-gray-100">
                    {group.picture ? (
                      <img src={group.picture} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Users className="h-16 w-16" />
                      </div>
                    )}
                  </div>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle>{group.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewGroupDetails(group)}>
                            View Members
                          </DropdownMenuItem>
                          {group.isOwner && (
                            <DropdownMenuItem onClick={generateInvite}>
                              Generate Invite
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => leaveGroup(group)}
                            className="text-red-600"
                          >
                            Leave Group
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription>
                      {group.about || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center">
                      <Users className="h-5 w-5 mr-2 text-gray-500" />
                      <span>{group.members} members</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="default" className="w-full" onClick={() => viewGroupDetails(group)}>
                      View Group
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
          
          {/* Join with Invite Code */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Join with Invite Code</h3>
            <div className="flex gap-2">
              <Input 
                placeholder="Enter invite code" 
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
              <Button onClick={joinGroupWithInvite}>Join</Button>
            </div>
          </div>
        </TabsContent>
        
        {/* Discover Groups Tab */}
        <TabsContent value="discover" className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Discover Groups</h2>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span className="ml-2">Loading groups...</span>
            </div>
          ) : publicGroups.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">No public groups available at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicGroups.map((group) => (
                <Card key={group.id} className="overflow-hidden">
                  <div className="relative h-32 bg-gray-100">
                    {group.picture ? (
                      <img src={group.picture} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Users className="h-16 w-16" />
                      </div>
                    )}
                  </div>
                  <CardHeader>
                    <CardTitle>{group.name}</CardTitle>
                    <CardDescription>
                      {group.about || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center">
                      <Users className="h-5 w-5 mr-2 text-gray-500" />
                      <span>{group.members} members</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="default" className="w-full" onClick={() => joinGroup(group)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Join Group
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Group Details Dialog */}
      {selectedGroup && (
        <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && setSelectedGroup(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedGroup.name}</DialogTitle>
              <DialogDescription>
                {selectedGroup.about || 'No description'}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <h3 className="text-lg font-semibold mb-4">Members ({groupMembers.length})</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {groupMembers.map((member) => (
                  <div key={member.pubkey} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center">
                      <Avatar className="h-10 w-10 mr-3">
                        {member.picture ? (
                          <img src={member.picture} alt={member.name} />
                        ) : (
                          <div className="bg-primary text-white flex items-center justify-center h-full">
                            {member.name?.[0] || member.pubkey.slice(0, 2)}
                          </div>
                        )}
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.role}</p>
                      </div>
                    </div>
                    {selectedGroup.isOwner && (
                      <Button variant="outline" size="sm" className="ml-2">
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedGroup(null)}>Close</Button>
              {selectedGroup.isOwner && (
                <Button onClick={generateInvite}>
                  Generate Invite
                </Button>
              )}
              {!selectedGroup.isOwner && selectedGroup.isMember && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    leaveGroup(selectedGroup);
                    setSelectedGroup(null);
                  }}
                >
                  Leave Group
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}