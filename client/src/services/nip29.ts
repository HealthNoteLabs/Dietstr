import NDK, { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';

/**
 * Event kinds used for groups according to NIP-29
 * 
 * NIP-29 defines the following event kinds:
 * 39000 - Group metadata
 * 39001 - Group admin metadata
 * 39002 - User metadata for group
 * 39003 - Relay metadata for group
 * 9000 - Admin adds user
 * 9001 - Admin removes user
 * 9020 - Admin message
 * 9021 - User joins group
 * 9022 - User leaves group
 * 30000-30009 - (Reserved)
 * 30078 - Application-specific (custom event)
 */
export const GROUP_EVENT_KINDS = {
  GROUP_DEFINITION: 39000, // Group definition event (metadata, etc.)
  GROUP_MEMBER: 9021,      // Membership claim event
  GROUP_ADMIN: 9020,       // Group admin event
  GROUP_POST: 1            // Standard note used for group posts (filtered by e tag)
};

// Comprehensive list of NIP-29 event kinds - include all possible ones
export const NIP29_EVENT_KINDS = {
  // Metadata events (39xxx)
  GROUP_METADATA: 39000,   // Group metadata
  ADMIN_METADATA: 39001,   // Group admin metadata
  USER_METADATA: 39002,    // User metadata
  RELAY_METADATA: 39003,   // Relay metadata
  
  // Moderation events (9xxx)
  ADD_USER: 9000,          // Admin adds user
  REMOVE_USER: 9001,       // Admin removes user
  ADMIN_MESSAGE: 9020,     // Admin message
  JOIN_GROUP: 9021,        // User joins group
  LEAVE_GROUP: 9022,       // User leaves group
  
  // All group-related event kinds in a single array (for filtering)
  ALL_GROUP_KINDS: [39000, 39001, 39002, 39003, 9000, 9001, 9020, 9021, 9022]
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
    event.kind = GROUP_EVENT_KINDS.GROUP_DEFINITION; // 39000
    
    // Create content with the group metadata
    const content = {
      name: params.name,
      about: params.about,
      picture: params.picture || null
    };
    event.content = JSON.stringify(content);
    
    // Add required NIP29 tags
    event.tags.push(['d', 'metadata']); // Required NIP29 d-tag
    
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

    // Log the event we're about to publish
    console.log('Creating group with event:', {
      kind: event.kind,
      content: event.content,
      tags: event.tags
    });

    // Sign and publish the event to all connected relays
    await event.publish();
    console.log(`Group definition event published with ID: ${event.id}`);
    
    // Now create the admin membership event (creator is automatically admin)
    const adminEvent = new NDKEvent(ndk);
    adminEvent.kind = GROUP_EVENT_KINDS.GROUP_ADMIN; // 9020
    adminEvent.tags = [
      ['e', event.id, '', 'root'],  // Tag the group event
      ['role', 'admin'],            // Specify role as admin
      ['p', event.pubkey]           // Tag the pubkey (often required)
    ];
    adminEvent.content = '';
    await adminEvent.publish();
    console.log(`Admin membership event published with ID: ${adminEvent.id}`);
    
    // Also create a regular membership event for better compatibility
    const memberEvent = new NDKEvent(ndk);
    memberEvent.kind = GROUP_EVENT_KINDS.GROUP_MEMBER; // 9021
    memberEvent.tags = [
      ['e', event.id, '', 'root'],  // Tag the group event
      ['role', 'member'],           // Specify role as member
      ['p', event.pubkey]           // Tag the pubkey (often required)
    ];
    memberEvent.content = '';
    await memberEvent.publish();
    console.log(`Member event published with ID: ${memberEvent.id}`);

    console.log(`Group created with ID: ${event.id} and published to all connected relays`);

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
    console.log('Connected relays:', ndk.pool?.relays?.size || 0);
    
    // Log connected relay URLs for debugging
    if (ndk.pool?.relays?.size) {
      console.log('Connected relay list:');
      ndk.pool.relays.forEach((relay, url) => {
        console.log(`- ${url} (${relay.status})`);
      });
    }
    
    // Use multiple event kinds for the search to find all possible NIP-29 groups
    // This is important as different clients might publish different event kinds
    const filter: NDKFilter = {
      kinds: [
        NIP29_EVENT_KINDS.GROUP_METADATA,    // Most common group metadata (39000)
        NIP29_EVENT_KINDS.ADMIN_METADATA,    // Admin metadata (39001)
        // We'll also look for membership events as a fallback since they might reference groups
        NIP29_EVENT_KINDS.JOIN_GROUP,        // Join events (9021)
        NIP29_EVENT_KINDS.ADMIN_MESSAGE      // Admin messages (9020)
      ],
      // Use a very broad time range to find all groups (5 years to be extra permissive)
      since: Math.floor(Date.now() / 1000) - 5 * 365 * 24 * 60 * 60, // 5 years ago
      limit: 1000, // Increased limit to get more groups
    };
    
    // Log more information for debugging
    console.log("Searching for groups with time range starting from:", 
      new Date((Math.floor(Date.now() / 1000) - 5 * 365 * 24 * 60 * 60) * 1000).toISOString());
    
    // Filter by tags if specified but only if user explicitly requests filtering
    if (options.tags && options.tags.length > 0) {
      filter['#t'] = options.tags;
    } else if (options.onlyDietstr && options.onlyDietstr === true) {
      // If no specific tags but only want Dietstr groups
      filter['#t'] = ['dietstr', 'diet', 'nutrition'];
    }
    
    // For debugging, we'll show ALL groups with no tag filtering
    if (!options.tags && !options.onlyDietstr) {
      // Remove any tag filtering to show ALL groups
      delete filter['#t'];
    }
    
    // Also get any events with Dietstr-related tags
    const filterWithDietTags: NDKFilter = {
      ...filter,
      '#t': ['dietstr', 'diet', 'nutrition', 'keto', 'vegan', 'food']
    };
    
    console.log('Group search filter:', filter);
    
    // First try with standard filter
    const events = await ndk.fetchEvents(filter, { 
      closeOnEose: false,
      // Explicitly include the Nostr relays we want to query
      relayUrls: [
        'wss://relay.damus.io',
        'wss://relay.nostr.band', 
        'wss://nos.lol',
        'wss://relay.current.fyi',
        'wss://relay.snort.social',
        'wss://relay.0xchat.com',
        'wss://nostr.wine'
      ]
    });
    
    // Also try with diet-specific tags as a separate search
    const eventsWithTags = await ndk.fetchEvents(filterWithDietTags, { 
      closeOnEose: false,
      // Query again with diet tags
      relayUrls: [
        'wss://relay.damus.io',
        'wss://relay.nostr.band', 
        'wss://nos.lol',
        'wss://relay.current.fyi',
        'wss://relay.snort.social',
        'wss://relay.0xchat.com',
        'wss://nostr.wine'
      ]
    });
    
    // Combine both result sets (will deduplicate by event ID)
    const allEvents = new Set<NDKEvent>();
    events.forEach(event => allEvents.add(event));
    eventsWithTags.forEach(event => allEvents.add(event));
    
    console.log(`Received ${allEvents.size} group events from relays (${events.size} from main search, ${eventsWithTags.size} with diet tags)`);
    
    if (allEvents.size === 0) {
      console.log("No group events were returned by the relays. Possible issues:");
      console.log("1. You may not be connected to the right relays for NIP-29 groups");
      console.log("2. The time range might be too short or the relays might not have events that old");
      console.log("3. The 'kind' parameter might not be set correctly for these relays");
    } else {
      console.log("Event sample:", Array.from(allEvents)[0]);
    }
    
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
    for (const event of allEvents) {
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
          
          // For debugging, log the relay this event came from if available
          if (event._relays && event._relays.length > 0) {
            console.log(`Found group "${group.name}" from relay: ${event._relays[0]}`);
          }
          
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