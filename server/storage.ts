import { 
  User, InsertUser, 
  FoodEntry, InsertFoodEntry,
  WaterEntry, InsertWaterEntry,
  Group, InsertGroup,
  GroupMember, InsertGroupMember,
  GroupInvite, InsertGroupInvite
} from "@shared/schema";

export interface IStorage {
  getUser(pubkey: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPreferences(userId: number, preferences: User['preferences']): Promise<User>;
  
  getFoodEntries(userId: number, date: Date): Promise<FoodEntry[]>;
  createFoodEntry(entry: InsertFoodEntry): Promise<FoodEntry>;
  
  getWaterEntries(userId: number, date: Date): Promise<WaterEntry[]>;
  createWaterEntry(entry: InsertWaterEntry): Promise<WaterEntry>;
  
  // Group methods
  getGroups(): Promise<Group[]>;
  getGroupById(groupId: number): Promise<Group | undefined>;
  createGroup(group: InsertGroup): Promise<Group>;
  
  getGroupMembers(groupId: number): Promise<GroupMember[]>;
  addGroupMember(member: InsertGroupMember): Promise<GroupMember>;
  
  createGroupInvite(invite: InsertGroupInvite): Promise<GroupInvite>;
  getGroupInviteByCode(code: string): Promise<GroupInvite | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private foodEntries: Map<number, FoodEntry>;
  private waterEntries: Map<number, WaterEntry>;
  private groups: Map<number, Group>;
  private groupMembers: Map<number, GroupMember>;
  private groupInvites: Map<number, GroupInvite>;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.foodEntries = new Map();
    this.waterEntries = new Map();
    this.groups = new Map();
    this.groupMembers = new Map();
    this.groupInvites = new Map();
    this.currentId = 1;
  }

  async getUser(pubkey: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.pubkey === pubkey);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.currentId++;
    const newUser: User = { 
      ...user, 
      id,
      preferences: user.preferences || null
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUserPreferences(userId: number, preferences: User['preferences']): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, preferences };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getFoodEntries(userId: number, date: Date): Promise<FoodEntry[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.foodEntries.values()).filter(entry => 
      entry.userId === userId && 
      entry.date >= startOfDay && 
      entry.date <= endOfDay
    );
  }

  async createFoodEntry(entry: InsertFoodEntry): Promise<FoodEntry> {
    const id = this.currentId++;
    const newEntry: FoodEntry = { 
      ...entry, 
      id, 
      nostrEventId: null, 
      groupId: null,
      protein: entry.protein ?? null,
      carbs: entry.carbs ?? null,
      fat: entry.fat ?? null,
      userId: entry.userId ?? null
    };
    this.foodEntries.set(id, newEntry);
    return newEntry;
  }

  async getWaterEntries(userId: number, date: Date): Promise<WaterEntry[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.waterEntries.values()).filter(entry => 
      entry.userId === userId && 
      entry.date >= startOfDay && 
      entry.date <= endOfDay
    );
  }

  async createWaterEntry(entry: InsertWaterEntry): Promise<WaterEntry> {
    const id = this.currentId++;
    const newEntry: WaterEntry = { 
      ...entry, 
      id, 
      nostrEventId: null, 
      groupId: null,
      userId: entry.userId ?? null
    };
    this.waterEntries.set(id, newEntry);
    return newEntry;
  }

  // Group methods implementation
  async getGroups(): Promise<Group[]> {
    return Array.from(this.groups.values());
  }

  async getGroupById(groupId: number): Promise<Group | undefined> {
    return this.groups.get(groupId);
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const id = this.currentId++;
    const now = new Date();
    const newGroup: Group = { 
      ...group, 
      id, 
      kind39000EventId: null, 
      createdAt: now,
      about: group.about ?? null,
      picture: group.picture ?? null,
      ownerId: group.ownerId ?? null
    };
    this.groups.set(id, newGroup);
    return newGroup;
  }

  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    return Array.from(this.groupMembers.values())
      .filter(member => member.groupId === groupId);
  }

  async addGroupMember(member: InsertGroupMember): Promise<GroupMember> {
    const id = this.currentId++;
    const now = new Date();
    const newMember: GroupMember = { 
      ...member, 
      id, 
      joinedAt: now,
      kind9021EventId: null,
      userId: member.userId ?? null,
      groupId: member.groupId ?? null,
      role: member.role ?? null
    };
    this.groupMembers.set(id, newMember);
    return newMember;
  }

  async createGroupInvite(invite: InsertGroupInvite): Promise<GroupInvite> {
    const id = this.currentId++;
    const now = new Date();
    const newInvite: GroupInvite = { 
      ...invite, 
      id, 
      createdAt: now,
      useCount: 0,
      isActive: true,
      groupId: invite.groupId ?? null,
      createdBy: invite.createdBy ?? null,
      expiresAt: invite.expiresAt ?? null,
      maxUses: invite.maxUses ?? null
    };
    this.groupInvites.set(id, newInvite);
    return newInvite;
  }

  async getGroupInviteByCode(code: string): Promise<GroupInvite | undefined> {
    return Array.from(this.groupInvites.values())
      .find(invite => invite.inviteCode === code && invite.isActive);
  }
}

export const storage = new MemStorage();
