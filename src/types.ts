import { CacheType, ChatInputCommandInteraction, Client, Collection, GuildMember, Message, Webhook } from 'discord.js';


export interface StaffReputationLog {
    timestamp: number;
    moderatorId: string;
    action: 'ADD_POS' | 'ADD_NEG' | 'PROMOTE' | 'DEMOTE' | 'RESET';
    amount: number;
    reason: string;
}

export interface LOAStatus {
    isActive: boolean;
    since: number | null;
    reason: string | null;
}

export interface UserData {
    userId: string;
    positiveRep: number; 
    negativeRep: number;
    reputationHistory: StaffReputationLog[];
    loaStatus: LOAStatus;
}

// --- CLIENT AND HANDLER TYPES ---
export interface CustomClient extends Client {
    commands: Collection<string, any>; // IApplicationCommand
    interactions: Collection<string, any>; // IInteraction
    database: any; // IDatabase
    errorTracker: any; // ErrorTracker
    webhookCache: Collection<string, Webhook>;
    interactionQueue: Collection<string, Promise<void>>; // For atomicity
}
