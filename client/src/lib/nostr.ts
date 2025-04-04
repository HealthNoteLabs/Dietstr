import { SimplePool as NostrSimplePool, nip19, getEventHash } from 'nostr-tools';
import { NIP29_EVENT_KINDS } from '@shared/schema';
import { nanoid } from 'nanoid';

// Define Event interface since we need to extend it
export interface Event {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

// Enhanced SimplePool with missing methods for NIP29
export class EnhancedSimplePool extends NostrSimplePool {
  // Add a mock implementation of list
  async list(relays: string[], filters: any[]): Promise<Event[]> {
    console.log('SimplePool.list called with filters:', filters);
    // This would normally query relays, but for now we'll return an empty array
    // In a real implementation, this would fetch real data
    return [];
  }
  
  // Override publish to accept our Event type and handle string relays
  // Match the return type of the original method which is Promise<string[]>
  async publish(relays: string[], event: Event): Promise<string[]> {
    console.log('Publishing event to relays:', relays);
    console.log('Event:', event);
    
    // In a real implementation, we would actually publish to relays
    // For now, just return an array with the event ID to simulate success
    return [event.id];
  }
}

// Helper function to get a public key from a private key
export function getPublicKey(privateKey: string): string {
  // In a real implementation, this would convert a private key to a public key
  // For now, we'll just return a mocked public key based on the input
  return `pub_${privateKey.substring(0, 8)}`;
}

// Helper function to sign an event (implementing simplified version of finishEvent)
export function finishEvent(event: Omit<Event, 'id' | 'sig'>, privateKey: string): Event {
  const id = getEventHash({
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content
  } as Event);
  
  // In a real implementation, we would sign properly but simulating for now
  const sig = `sig_${id}_by_${event.pubkey}`;
  
  return {
    ...event,
    id,
    sig
  };
}

export const pool = new EnhancedSimplePool();

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
];

// Adding a dedicated relay for groups (in a real implementation, this could be configurable)
export const GROUP_RELAY = 'wss://groups.nostr.com';

export interface NostrEvent {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey: string;
  id?: string;
  sig?: string;
}

export async function publishEvent(event: Partial<NostrEvent>, privateKey: string): Promise<string | undefined> {
  try {
    // Create a fully formed event
    const fullEvent = finishEvent({
      kind: event.kind!,
      content: event.content!,
      tags: event.tags || [],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: getPublicKey(privateKey)
    }, privateKey);
    
    // Publish the event
    await pool.publish(RELAYS, fullEvent);
    return fullEvent.id;
  } catch (error) {
    console.error('Failed to publish event:', error);
    return undefined;
  }
}

export function getPrivateKeyFromNsec(nsec: string): string {
  try {
    const decoded = nip19.decode(nsec);
    return decoded.data as string;
  } catch {
    throw new Error('Invalid nsec format');
  }
}

export function getPubKeyFromPrivateKey(privateKey: string): string {
  return getPublicKey(privateKey);
}

// NIP29 Group Functions
// =====================

/**
 * Generate a unique group ID in NIP29 format: <host>'<group-id>
 * @param host The host identifier
 * @returns Formatted group ID 
 */
export function generateGroupId(host: string = 'dietstr.app'): string {
  // Generate a random ID with characters a-z, 0-9, -, _
  const randomId = nanoid(12).toLowerCase().replace(/[^a-z0-9-_]/g, '');
  return `${host}'${randomId}`;
}

/**
 * Create a new group with the provided metadata
 * @param name Group name
 * @param about Group description
 * @param picture Group profile image URL
 * @param privateKey User's private key
 * @returns Created group data and event ID
 */
export async function createGroup(
  name: string, 
  about: string, 
  picture: string, 
  privateKey: string
): Promise<{ groupId: string, eventId: string } | undefined> {
  try {
    const pubkey = getPublicKey(privateKey);
    const groupId = generateGroupId();
    
    // Create group metadata event (kind 39000)
    const event = {
      kind: NIP29_EVENT_KINDS.GROUP_METADATA,
      content: JSON.stringify({
        name,
        about,
        picture
      }),
      tags: [
        ['h', groupId],
        ['d', 'metadata']
      ],
      created_at: Math.floor(Date.now() / 1000),
      pubkey
    };
    
    // Sign and publish the event
    const signedEvent = finishEvent(event, privateKey);
    await pool.publish([GROUP_RELAY], signedEvent);
    
    return {
      groupId,
      eventId: signedEvent.id
    };
  } catch (error) {
    console.error('Failed to create group:', error);
    return undefined;
  }
}

/**
 * Request to join a group
 * @param groupId The group ID to join
 * @param privateKey User's private key
 * @param inviteCode Optional invite code
 * @returns The event ID of the join request
 */
export async function requestJoinGroup(
  groupId: string,
  privateKey: string,
  inviteCode?: string
): Promise<string | undefined> {
  try {
    const pubkey = getPublicKey(privateKey);
    const tags = [['h', groupId]];
    
    // Add invite code if provided
    if (inviteCode) {
      tags.push(['code', inviteCode]);
    }
    
    // Create join request event (kind 9021)
    const event = {
      kind: NIP29_EVENT_KINDS.JOIN_REQUEST,
      content: 'Requesting to join group',
      tags,
      created_at: Math.floor(Date.now() / 1000),
      pubkey
    };
    
    // Sign and publish the event
    const signedEvent = finishEvent(event, privateKey);
    await pool.publish([GROUP_RELAY], signedEvent);
    
    return signedEvent.id;
  } catch (error) {
    console.error('Failed to request join group:', error);
    return undefined;
  }
}

/**
 * Request to leave a group
 * @param groupId The group ID to leave
 * @param privateKey User's private key
 * @returns The event ID of the leave request
 */
export async function requestLeaveGroup(
  groupId: string,
  privateKey: string
): Promise<string | undefined> {
  try {
    const pubkey = getPublicKey(privateKey);
    
    // Create leave request event (kind 9022)
    const event = {
      kind: NIP29_EVENT_KINDS.LEAVE_REQUEST,
      content: 'Requesting to leave group',
      tags: [['h', groupId]],
      created_at: Math.floor(Date.now() / 1000),
      pubkey
    };
    
    // Sign and publish the event
    const signedEvent = finishEvent(event, privateKey);
    await pool.publish([GROUP_RELAY], signedEvent);
    
    return signedEvent.id;
  } catch (error) {
    console.error('Failed to request leave group:', error);
    return undefined;
  }
}

/**
 * Add a user to a group (admin/owner only)
 * @param groupId The group ID 
 * @param userPubkey The pubkey of the user to add
 * @param privateKey Admin's private key
 * @returns The event ID
 */
export async function addUserToGroup(
  groupId: string,
  userPubkey: string,
  privateKey: string
): Promise<string | undefined> {
  try {
    const adminPubkey = getPublicKey(privateKey);
    
    // Get timeline references (past events) for the group
    const timelineReferences = await getGroupTimelineReferences(groupId);
    
    // Create add user event (kind 9000)
    const event = {
      kind: NIP29_EVENT_KINDS.ADD_USER,
      content: '',
      tags: [
        ['h', groupId],
        ['p', userPubkey],
        ...timelineReferences.map(ref => ['e', ref]),
      ],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: adminPubkey
    };
    
    // Sign and publish the event
    const signedEvent = finishEvent(event, privateKey);
    await pool.publish([GROUP_RELAY], signedEvent);
    
    return signedEvent.id;
  } catch (error) {
    console.error('Failed to add user to group:', error);
    return undefined;
  }
}

/**
 * Remove a user from a group (admin/owner only)
 * @param groupId The group ID
 * @param userPubkey The pubkey of the user to remove
 * @param privateKey Admin's private key
 * @returns The event ID
 */
export async function removeUserFromGroup(
  groupId: string,
  userPubkey: string,
  privateKey: string
): Promise<string | undefined> {
  try {
    const adminPubkey = getPublicKey(privateKey);
    
    // Get timeline references (past events) for the group
    const timelineReferences = await getGroupTimelineReferences(groupId);
    
    // Create remove user event (kind 9001)
    const event = {
      kind: NIP29_EVENT_KINDS.REMOVE_USER,
      content: '',
      tags: [
        ['h', groupId],
        ['p', userPubkey],
        ...timelineReferences.map(ref => ['e', ref]),
      ],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: adminPubkey
    };
    
    // Sign and publish the event
    const signedEvent = finishEvent(event, privateKey);
    await pool.publish([GROUP_RELAY], signedEvent);
    
    return signedEvent.id;
  } catch (error) {
    console.error('Failed to remove user from group:', error);
    return undefined;
  }
}

/**
 * Get the most recent events from a group to use as timeline references
 * NIP29 requires referencing previous events to provide context
 * @param groupId The group ID to get references for
 * @returns Array of event IDs (max 3)
 */
export async function getGroupTimelineReferences(groupId: string): Promise<string[]> {
  try {
    // Get the most recent 50 events for this group
    const filter = {
      kinds: [
        NIP29_EVENT_KINDS.GROUP_METADATA,
        NIP29_EVENT_KINDS.ADMIN_METADATA,
        NIP29_EVENT_KINDS.ADD_USER,
        NIP29_EVENT_KINDS.REMOVE_USER,
        NIP29_EVENT_KINDS.JOIN_REQUEST,
        NIP29_EVENT_KINDS.LEAVE_REQUEST,
      ],
      '#h': [groupId],
      limit: 50
    };
    
    const events = await pool.list([GROUP_RELAY], [filter]);
    
    // Sort by created_at (newest first)
    events.sort((a, b) => b.created_at - a.created_at);
    
    // Take the first 3 event IDs (or fewer if there aren't enough)
    return events.slice(0, 3).map(event => event.id);
  } catch (error) {
    console.error('Failed to get group timeline references:', error);
    return [];
  }
}

/**
 * Post a text note to a group
 * @param groupId The group ID
 * @param content The note content
 * @param privateKey User's private key
 * @returns The event ID
 */
export async function postGroupNote(
  groupId: string,
  content: string,
  privateKey: string
): Promise<string | undefined> {
  try {
    const pubkey = getPublicKey(privateKey);
    
    // Get timeline references (past events) for the group
    const timelineReferences = await getGroupTimelineReferences(groupId);
    
    // Create text note event (kind 1) with group tag
    const event = {
      kind: NIP29_EVENT_KINDS.TEXT_NOTE,
      content,
      tags: [
        ['h', groupId],
        ...timelineReferences.map(ref => ['e', ref]),
      ],
      created_at: Math.floor(Date.now() / 1000),
      pubkey
    };
    
    // Sign and publish the event
    const signedEvent = finishEvent(event, privateKey);
    await pool.publish([GROUP_RELAY], signedEvent);
    
    return signedEvent.id;
  } catch (error) {
    console.error('Failed to post group note:', error);
    return undefined;
  }
}

/**
 * Create a group invite code
 * @param groupId The group ID
 * @param privateKey Admin's private key
 * @param maxUses Optional maximum number of uses
 * @param expiresAt Optional expiration timestamp
 * @returns The invite code
 */
export async function createGroupInvite(
  groupId: string,
  privateKey: string,
  maxUses?: number,
  expiresAt?: number
): Promise<string | undefined> {
  try {
    const pubkey = getPublicKey(privateKey);
    
    // Generate a random invite code
    const inviteCode = nanoid(10);
    
    // Get timeline references (past events) for the group
    const timelineReferences = await getGroupTimelineReferences(groupId);
    
    // Create invite code event (currently no specific kind defined, using metadata)
    const event = {
      kind: NIP29_EVENT_KINDS.GROUP_METADATA,
      content: JSON.stringify({
        type: 'invite',
        code: inviteCode,
        maxUses,
        expiresAt
      }),
      tags: [
        ['h', groupId],
        ['d', 'invite'],
        ...timelineReferences.map(ref => ['e', ref]),
      ],
      created_at: Math.floor(Date.now() / 1000),
      pubkey
    };
    
    // Sign and publish the event
    const signedEvent = finishEvent(event, privateKey);
    await pool.publish([GROUP_RELAY], signedEvent);
    
    return inviteCode;
  } catch (error) {
    console.error('Failed to create group invite:', error);
    return undefined;
  }
}

/**
 * Get all events from a group
 * @param groupId The group ID
 * @param kinds Optional array of event kinds to filter
 * @param limit Optional limit on number of events
 * @returns Array of events
 */
export async function getGroupEvents(
  groupId: string,
  kinds?: number[],
  limit: number = 100
): Promise<Event[]> {
  try {
    const filter = {
      '#h': [groupId],
      kinds: kinds || undefined,
      limit
    };
    
    const events = await pool.list([GROUP_RELAY], [filter]);
    
    // Sort by created_at (newest first)
    return events.sort((a, b) => b.created_at - a.created_at);
  } catch (error) {
    console.error('Failed to get group events:', error);
    return [];
  }
}

/**
 * Get group metadata
 * @param groupId The group ID
 * @returns Group metadata or undefined if not found
 */
export async function getGroupMetadata(groupId: string): Promise<{ name: string, about: string, picture: string } | undefined> {
  try {
    const filter = {
      kinds: [NIP29_EVENT_KINDS.GROUP_METADATA],
      '#h': [groupId],
      '#d': ['metadata'],
      limit: 1
    };
    
    const events = await pool.list([GROUP_RELAY], [filter]);
    
    if (events.length === 0) {
      return undefined;
    }
    
    // Parse the content as JSON
    const content = JSON.parse(events[0].content);
    
    return {
      name: content.name || '',
      about: content.about || '',
      picture: content.picture || ''
    };
  } catch (error) {
    console.error('Failed to get group metadata:', error);
    return undefined;
  }
}
