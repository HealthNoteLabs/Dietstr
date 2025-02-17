import { 
  User, InsertUser, 
  FoodEntry, InsertFoodEntry,
  WaterEntry, InsertWaterEntry 
} from "@shared/schema";

export interface IStorage {
  getUser(pubkey: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPreferences(userId: number, preferences: User['preferences']): Promise<User>;
  
  getFoodEntries(userId: number, date: Date): Promise<FoodEntry[]>;
  createFoodEntry(entry: InsertFoodEntry): Promise<FoodEntry>;
  
  getWaterEntries(userId: number, date: Date): Promise<WaterEntry[]>;
  createWaterEntry(entry: InsertWaterEntry): Promise<WaterEntry>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private foodEntries: Map<number, FoodEntry>;
  private waterEntries: Map<number, WaterEntry>;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.foodEntries = new Map();
    this.waterEntries = new Map();
    this.currentId = 1;
  }

  async getUser(pubkey: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.pubkey === pubkey);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.currentId++;
    const newUser = { ...user, id };
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
    const newEntry = { ...entry, id, nostrEventId: null };
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
    const newEntry = { ...entry, id, nostrEventId: null };
    this.waterEntries.set(id, newEntry);
    return newEntry;
  }
}

export const storage = new MemStorage();
