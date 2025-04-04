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
    
    // Add tags for discoverability
    event.tags.push(['t', 'dietstr']); // Main app tag
    event.tags.push(['t', 'diet']);
    event.tags.push(['t', 'nutrition']);
    
    // Add any additional tags from the name/description
    if (params.name.toLowerCase().includes('keto') || params.about.toLowerCase().includes('keto')) {
      event.tags.push(['t', 'keto']);
    }
    if (params.name.toLowerCase().includes('vegan') || params.about.toLowerCase().includes('vegan')) {
      event.tags.push(['t', 'vegan']);
    }
    if (params.name.toLowerCase().includes('weight') || params.about.toLowerCase().includes('weight')) {
      event.tags.push(['t', 'weightloss']);
    }

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
    
    // Also create a regular membership event for better compatibility
    const memberEvent = new NDKEvent(ndk);
    memberEvent.kind = GROUP_EVENT_KINDS.GROUP_MEMBER;
    memberEvent.tags = [
      ['e', event.id, '', 'root'],  // Tag the group event
      ['role', 'member']            // Specify role as member
    ];
    memberEvent.content = '';
    await memberEvent.publish();

    console.log(`Group created with ID: ${event.id} and published to relays`);

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
/**
 * Interface for group filtering options
 */
export interface GroupFilterOptions {
  tags?: string[];      // Tags to filter by
  onlyDietstr?: boolean; // Only show Dietstr-specific groups
  search?: string;      // Search text
  limit?: number;       // Maximum number of groups to return
}

/**
 * Fetch available groups with filtering options
 * @param ndk NDK instance
 * @param options Filtering options
 * @returns Array of groups matching the filters
 */
export async function fetchGroups(
  ndk: NDK, 
  options: GroupFilterOptions = {}
): Promise<GroupInfo[]> {
  try {
    console.log('Fetching groups from Nostr relays...');
    
    // Build the filter based on options
    const filter: NDKFilter = {
      kinds: [GROUP_EVENT_KINDS.GROUP_DEFINITION],
      // Use a much broader time range to find all groups
      since: Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60, // 1 year ago
    };
    
    // Log more information for debugging
    console.log("Searching for groups with time range starting from:", 
      new Date((Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60) * 1000).toISOString());
    
    // Filter by tags if specified
    if (options.tags && options.tags.length > 0) {
      filter['#t'] = options.tags;
    } else if (options.onlyDietstr) {
      // If no specific tags but only want Dietstr groups
      filter['#t'] = ['dietstr', 'diet', 'nutrition'];
    }
    
    // Temporary: Remove tag filtering to see all groups for testing
    delete filter['#t'];
    
    console.log('Group search filter:', filter);
    const events = await ndk.fetchEvents(filter, { closeOnEose: false });
    console.log(`Received ${events.size} group events from relays`);
    
    const groups: GroupInfo[] = [];
    
    // Helper function to check if a group matches the search query
    const matchesSearch = (group: GroupInfo, search: string): boolean => {
      if (!search) return true;
      
      const searchLower = search.toLowerCase();
      return (
        group.name.toLowerCase().includes(searchLower) ||
        group.about.toLowerCase().includes(searchLower)
      );
    };
    
    // Process events to extract group information
    for (const event of events) {
      try {
        // Parse group content - handle both JSON and plain text
        let content;
        try {
          content = JSON.parse(event.content);
        } catch {
          // If parsing fails, try to use the content directly
          content = {
            name: event.content || 'Unnamed Group',
            about: '',
          };
        }
        
        if (content && (content.name || content.about)) {
          const group: GroupInfo = {
            id: event.id,
            name: content.name || 'Unnamed Group',
            about: content.about || '',
            picture: content.picture,
            createdAt: event.created_at || Math.floor(Date.now() / 1000),
            createdBy: event.pubkey
          };
          
          // Check if group matches search query
          if (!options.search || matchesSearch(group, options.search)) {
            // Include it in the results
            groups.push(group);
          }
        }
      } catch (error) {
        console.warn('Invalid group event format:', event);
      }
    }
    
    // Sort groups by creation date (newest first)
    groups.sort((a, b) => b.createdAt - a.createdAt);
    
    // Apply limit if specified
    const result = options.limit ? groups.slice(0, options.limit) : groups;
    
    console.log(`Processed ${groups.length} valid groups, returning ${result.length}`);
    return result;
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