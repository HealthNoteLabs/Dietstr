import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNostrContext } from '../contexts/NostrContext';
import { useQuery } from '@tanstack/react-query';
import { NDKEvent } from '@nostr-dev-kit/ndk';
// Import with type assertions to avoid TypeScript errors
import * as nip29 from '../services/nip29';
const { fetchGroupById, fetchGroupMembers, postToGroup } = nip29;
import { useToast } from './use-toast';

type Member = {
  pubkey: string;
  role: string;
  addedAt: number;
};

type GroupInfo = {
  id: string;
  name: string;
  about: string;
  picture?: string;
  createdAt: number;
  createdBy: string;
};

export function useGroup(groupId?: string) {
  const { ndk, userPubkey } = useNostrContext();
  const { toast } = useToast();
  const [posting, setPosting] = useState(false);

  // Fetch group info
  const { 
    data: group,
    isLoading: loadingGroup,
    error: groupError
  } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      if (!ndk || !groupId) return null;
      return await fetchGroupById(ndk, groupId);
    },
    enabled: !!ndk && !!groupId,
  });

  // Fetch group members
  const {
    data: members,
    isLoading: loadingMembers,
    error: membersError,
    refetch: refetchMembers
  } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      if (!ndk || !groupId) return [];
      return await fetchGroupMembers(ndk, groupId);
    },
    enabled: !!ndk && !!groupId,
  });

  // Check if current user is a member (using useMemo for derivation)
  const isMember = useMemo(() => {
    return members?.some(member => member.pubkey === userPubkey) || false;
  }, [members, userPubkey]);

  // Check if user is an admin (using useMemo for derivation)
  const isAdmin = useMemo(() => {
    return members?.some(
      member => member.pubkey === userPubkey && member.role === 'admin'
    ) || false;
  }, [members, userPubkey]);

  // Post content to the group (using useCallback for consistent hook order)
  const postContent = useCallback(async (content: string) => {
    if (!ndk || !userPubkey || !groupId) {
      toast({
        title: 'Error',
        description: 'You need to be connected to Nostr to post',
        variant: 'destructive',
      });
      return;
    }

    if (!isMember) {
      toast({
        title: 'Error',
        description: 'You need to be a member of this group to post',
        variant: 'destructive',
      });
      return;
    }

    setPosting(true);
    try {
      const event = await postToGroup(ndk, {
        groupId,
        content,
      });
      
      toast({
        title: 'Posted successfully',
        description: 'Your message has been posted to the group',
      });

      return event;
    } catch (error) {
      toast({
        title: 'Failed to post',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return null;
    } finally {
      setPosting(false);
    }
  }, [ndk, userPubkey, groupId, isMember, toast]);

  // Subscribe to new posts in the group
  useEffect(() => {
    if (!ndk || !groupId) return;

    // Subscribe to group events
    const sub = ndk.subscribe(
      {
        kinds: [1], // Notes/posts
        '#e': [groupId], // Tagged with the group ID
      },
      { closeOnEose: false }
    );

    const onEvent = (event: NDKEvent) => {
      console.log('New group post received:', event);
      // Handle incoming post (you can trigger a refetch or update state directly)
    };

    sub.on('event', onEvent);

    return () => {
      sub.off('event', onEvent);
      sub.stop();
    };
  }, [ndk, groupId]);

  return {
    group,
    members,
    isMember,
    isAdmin,
    posting,
    postContent,
    loadingGroup,
    loadingMembers,
    groupError,
    membersError,
    refetchMembers,
  };
}