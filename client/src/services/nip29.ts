import NDK, { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';

/**
 * Event kinds used for groups according to NIP-29
 */
export const GROUP_EVENT_KINDS = {
  GROUP_DEFINITION: 39000, // Group definition event (metadata, etc.)
  GROUP_MEMBER: 9021,     // Membership claim event
  GROUP_ADMIN: 9020,      // Group admin event
  GROUP_POST: 1           // Standard note used for group posts (filtered by e tag)
};

/**
 * Interface for group information
 */
export interface GroupInfo {
  id: string;           // The event ID of the group definition event
  name: string;         // Group name
  about: string;        // Group description
  picture?: string;     // Optional avatar URL for the group
  createdAt: number;    // Timestamp when the group was created
  createdBy: string;    // Pubkey of the group creator
}

/**
 * Interface for group member
 */
export interface GroupMember {
  pubkey: string;       // Member's public key
  role: 'admin' | 'member'; // Role in the group
  addedAt: number;      // When they joined
}

/**
 * Interface for group creation parameters
 */
export interface CreateGroupParams {
  name: string;
  about: string;
  picture?: string;
}

/**
 * Interface for posting to a group
 */
export interface PostToGroupParams {
  groupId: string;
  content: string;
}

/**
 * Create a new group
 * @param ndk NDK instance
 * @param params Group creation parameters
 * @returns The created group
 */
export async function createGroup(
  ndk: NDK,
  params: CreateGroupParams
): Promise<GroupInfo> {
  try {
    // Create a new event for the group definition
    const event = new NDKEvent(ndk);
    event.kind = GROUP_EVENT_KINDS.GROUP_DEFINITION;
    event.content = JSON.stringify({
      name: params.name,
      about: params.about,
      picture: params.picture
    });

    // Sign and publish the event
    await event.publish();
    
    // Now create the admin membership event (creator is automatically admin)
    const adminEvent = new NDKEvent(ndk);
    adminEvent.kind = GROUP_EVENT_KINDS.GROUP_ADMIN;
    adminEvent.tags = [
      ['e', event.id, '', 'root'],  // Tag the group event
      ['role', 'admin']             // Specify role as admin
    ];
    adminEvent.content = '';
    await adminEvent.publish();

    // Return the group info
    return {
      id: event.id,
      name: params.name,
      about: params.about,
      picture: params.picture,
      createdAt: event.created_at || Math.floor(Date.now() / 1000),
      createdBy: event.pubkey
    };
  } catch (error) {
    console.error('Failed to create group:', error);
    throw new Error('Failed to create group');
  }
}

/**
 * Fetch all available groups
 * @param ndk NDK instance
 * @returns Array of groups
 */
export async function fetchGroups(ndk: NDK): Promise<GroupInfo[]> {
  try {
    console.log('Fetching groups from Nostr relays...');
    
    // Fetch kind 39000 events which are group definitions
    const filter: NDKFilter = {
      kinds: [GROUP_EVENT_KINDS.GROUP_DEFINITION],
      // Add a reasonable time range to improve relay search
      since: Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60, // 90 days ago
    };
    
    console.log('Group search filter:', filter);
    const events = await ndk.fetchEvents(filter);
    console.log(`Received ${events.size} group events from relays`);
    
    const groups: GroupInfo[] = [];
    for (const event of events) {
      try {
        console.log('Processing group event:', event.id);
        let content;
        try {
          content = JSON.parse(event.content);
        } catch {
          // If parsing fails, try to use the content directly (some clients might not JSON stringify)
          content = {
            name: event.content || 'Unnamed Group',
            about: '',
          };
        }
        
        // Only add valid groups with a name
        if (content && (content.name || content.about)) {
          groups.push({
            id: event.id,
            name: content.name || 'Unnamed Group',
            about: content.about || '',
            picture: content.picture,
            createdAt: event.created_at || Math.floor(Date.now() / 1000),
            createdBy: event.pubkey
          });
        }
      } catch (error) {
        console.warn('Invalid group event format:', event);
      }
    }
    
    console.log(`Processed ${groups.length} valid groups`);
    return groups;
  } catch (error) {
    console.error('Failed to fetch groups:', error);
    return [];
  }
}

/**
 * Fetch a specific group by its ID
 * @param ndk NDK instance
 * @param groupId The event ID of the group definition
 * @returns Group information or null if not found
 */
export async function fetchGroupById(ndk: NDK, groupId: string): Promise<GroupInfo | null> {
  try {
    // Fetch the specific group definition event
    const event = await ndk.fetchEvent({
      ids: [groupId],
      kinds: [GROUP_EVENT_KINDS.GROUP_DEFINITION]
    });
    
    if (!event) {
      return null;
    }
    
    try {
      const content = JSON.parse(event.content);
      return {
        id: event.id,
        name: content.name || 'Unnamed Group',
        about: content.about || '',
        picture: content.picture,
        createdAt: event.created_at || 0,
        createdBy: event.pubkey
      };
    } catch (error) {
      console.warn('Invalid group event format:', event);
      return null;
    }
  } catch (error) {
    console.error('Failed to fetch group:', error);
    return null;
  }
}

/**
 * Fetch all members of a group
 * @param ndk NDK instance
 * @param groupId The event ID of the group
 * @returns Array of group members
 */
export async function fetchGroupMembers(ndk: NDK, groupId: string): Promise<GroupMember[]> {
  try {
    // Fetch membership claims (9021) and admin claims (9020)
    const filter: NDKFilter = {
      kinds: [GROUP_EVENT_KINDS.GROUP_MEMBER, GROUP_EVENT_KINDS.GROUP_ADMIN],
      '#e': [groupId]
    };
    
    const events = await ndk.fetchEvents(filter);
    
    // Process events to extract member information
    const members = new Map<string, GroupMember>();
    
    for (const event of events) {
      const pubkey = event.pubkey;
      const kind = event.kind;
      const addedAt = event.created_at || Math.floor(Date.now() / 1000);
      
      // Determine role
      let role: 'admin' | 'member' = 'member';
      if (kind === GROUP_EVENT_KINDS.GROUP_ADMIN) {
        role = 'admin';
      } else {
        // Check for role tag in membership event
        const roleTag = event.tags.find(tag => tag[0] === 'role');
        if (roleTag && roleTag[1] === 'admin') {
          role = 'admin';
        }
      }
      
      // Add to members map (newer events override older ones)
      const existingMember = members.get(pubkey);
      if (!existingMember || existingMember.addedAt < addedAt) {
        members.set(pubkey, { pubkey, role, addedAt });
      }
    }
    
    return Array.from(members.values());
  } catch (error) {
    console.error('Failed to fetch group members:', error);
    return [];
  }
}

/**
 * Join a group
 * @param ndk NDK instance
 * @param groupId The event ID of the group
 * @returns The membership event
 */
export async function joinGroup(ndk: NDK, groupId: string): Promise<NDKEvent> {
  try {
    // Create membership claim event
    const event = new NDKEvent(ndk);
    event.kind = GROUP_EVENT_KINDS.GROUP_MEMBER;
    event.tags = [
      ['e', groupId, '', 'root'],  // Tag the group event
      ['role', 'member']           // Specify role as member
    ];
    event.content = '';
    
    // Sign and publish the event
    await event.publish();
    return event;
  } catch (error) {
    console.error('Failed to join group:', error);
    throw new Error('Failed to join group');
  }
}

/**
 * Post content to a group
 * @param ndk NDK instance
 * @param params Post parameters
 * @returns The post event
 */
export async function postToGroup(ndk: NDK, params: PostToGroupParams): Promise<NDKEvent> {
  try {
    // Create a new note event
    const event = new NDKEvent(ndk);
    event.kind = GROUP_EVENT_KINDS.GROUP_POST; // Regular note
    event.content = params.content;
    
    // Add group reference tag
    event.tags = [
      ['e', params.groupId, '', 'root']  // Tag the group
    ];
    
    // Sign and publish the event
    await event.publish();
    return event;
  } catch (error) {
    console.error('Failed to post to group:', error);
    throw new Error('Failed to post to group');
  }
}

/**
 * Subscribe to all events related to a specific group
 * @param ndk NDK instance
 * @param groupId The event ID of the group
 * @param callback Function to call when new events arrive
 * @returns Subscription object that can be used to unsubscribe
 */
export function subscribeToGroup(
  ndk: NDK,
  groupId: string,
  callback: (event: NDKEvent) => void
): NDKSubscription {
  // Create a subscription for all events related to this group
  const sub = ndk.subscribe(
    {
      '#e': [groupId], // All events that reference the group
      kinds: [1, 7, 9021, 9020] // Posts, reactions, memberships, admin events
    },
    { closeOnEose: false }
  );
  
  // Set up event handler
  sub.on('event', callback);
  
  return sub;
}

/**
 * Leave a group
 * @param ndk NDK instance
 * @param groupId The event ID of the group
 * @returns Result of leaving
 */
export async function leaveGroup(ndk: NDK, groupId: string): Promise<boolean> {
  try {
    // For now, there's no explicit "leave" event in NIP-29
    // An approach could be to create a "leave" note, but this isn't standardized
    const event = new NDKEvent(ndk);
    event.kind = 1;  // Regular note
    event.content = "I'm leaving this group";
    event.tags = [
      ['e', groupId, '', 'root'],
      ['t', 'leave']
    ];
    
    await event.publish();
    return true;
  } catch (error) {
    console.error('Failed to leave group:', error);
    return false;
  }
}