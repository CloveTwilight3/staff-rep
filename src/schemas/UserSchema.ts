import { Schema, model } from 'mongoose';
import { UserData } from '../types';

// Default User Data for initialization
export const DEFAULT_USER_DATA: Omit<UserData, 'userId'> = {

    positiveRep: 0,
    negativeRep: 0,
    reputationHistory: [],
    loaStatus: {
        isActive: false,
        since: null,
        reason: null
    }, // <--- Fixed: Added missing closing bracket/comma here
};

const UserSchema = new Schema<UserData>({
    userId: { type: String, required: true, unique: true }, 

    // --- Staff Management System Fields ---
    positiveRep: { type: Number, default: DEFAULT_USER_DATA.positiveRep },
    negativeRep: { type: Number, default: DEFAULT_USER_DATA.negativeRep },
    
    reputationHistory: {
        type: [{
            timestamp: { type: Number, required: true },
            moderatorId: { type: String, required: true },
            action: { type: String, required: true },
            amount: { type: Number, required: true },
            reason: { type: String, required: true }
        }],
        default: DEFAULT_USER_DATA.reputationHistory
    },

    loaStatus: {
        isActive: { type: Boolean, default: false },
        since: { type: Number, default: null },
        reason: { type: String, default: null }
    },

});

export const UserModel = model<UserData>('User', UserSchema);