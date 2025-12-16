import { EmbedBuilder, TextChannel, User, GuildMember, ButtonBuilder, ActionRowBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { CustomClient, UserData, StaffReputationLog } from '../types';

const configPath = path.join(process.cwd(), 'src', 'staffConfig.json');
export const staffConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export class StaffLogic {
    
    static isAuthorized(member: GuildMember): boolean {
        if (staffConfig.developerIds.includes(member.id)) return true;
        return member.roles.cache.has(staffConfig.roles.manager);
    }

    static async addLog(client: CustomClient, userId: string, log: StaffReputationLog) {
        const user = await client.database.getUser(userId);
        if (!user) return;
        
        const history = user.reputationHistory || [];
        history.push(log);
        
        await client.database.updateUser(userId, { reputationHistory: history });
    }

    static async checkThreshold(client: CustomClient, member: GuildMember, userData: UserData, lastReason: string) {
        const pos = userData.positiveRep || 0;
        const neg = userData.negativeRep || 0;

        // No threshold met
        if (pos < 10 && neg < 10) return;

        const managementChannel = await client.channels.fetch(staffConfig.channels.management) as TextChannel;
        if (!managementChannel) return;

        const isPromo = pos >= 10;
        const color = isPromo ? 0x00ff00 : 0xff0000;
        const title = isPromo ? '🚀 Promotion Request' : '⚠️ Demotion Request';
        const triggerValue = isPromo ? `${pos} Positive Points` : `${neg} Negative Points`;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(`**User:** ${member} (${member.id})\n**Status:** ✅ ${pos} | ❌ ${neg}\n**Trigger:** Reached ${triggerValue}\n**Last Reason:** ${lastReason}`)
            .setColor(color)
            .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`BTN_APPROVE_REQ_${member.id}_${isPromo ? 'PROMO' : 'DEMO'}`)
                    .setLabel('Approve & Process')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`BTN_DENY_REQ_${member.id}`)
                    .setLabel('Deny (Dismiss)')
                    .setStyle(ButtonStyle.Secondary)
            );

        await managementChannel.send({ embeds: [embed], components: [row] });
    }

    static async processRankChange(client: CustomClient, member: GuildMember, type: 'PROMO' | 'DEMO', moderator: User): Promise<string> {
        const sortedRoles = [...staffConfig.roles.staffHierarchy].sort((a: any, b: any) => a.rank - b.rank);
        const currentConfig = sortedRoles.find((r: any) => member.roles.cache.has(r.id));
        
        if (!currentConfig) return "❌ User does not hold a recognized staff role.";

        const currentIndex = sortedRoles.indexOf(currentConfig);
        let newRoleConfig;

        if (type === 'PROMO') {
            newRoleConfig = sortedRoles[currentIndex + 1];
            if (!newRoleConfig) return "⚠️ User is already at the highest rank.";
        } else {
            newRoleConfig = sortedRoles[currentIndex - 1];
            if (!newRoleConfig) return "⚠️ User is already at the lowest rank.";
        }

        // Swap Roles
        await member.roles.remove(currentConfig.id);
        await member.roles.add(newRoleConfig.id);

        // Reset BOTH counters on rank change
        await client.database.updateUser(member.id, { positiveRep: 0, negativeRep: 0 });
        
        await this.addLog(client, member.id, {
            timestamp: Date.now(),
            moderatorId: moderator.id,
            action: type === 'PROMO' ? 'PROMOTE' : 'DEMOTE',
            amount: 0,
            reason: `Authorized by ${moderator.tag}`
        });

        // Try DM
        try {
            const action = type === 'PROMO' ? 'Promoted' : 'Demoted';
            await member.send(`You have been **${action}** to **${newRoleConfig.name}** in ${member.guild.name}.`);
        } catch (e) {}

        return `✅ Successfully ${type === 'PROMO' ? 'Promoted' : 'Demoted'} **${member.user.username}** to **${newRoleConfig.name}**.`;
    }

    static generateExport(userData: UserData, username: string): AttachmentBuilder {
        let content = `STAFF REPUTATION HISTORY FOR: ${username} (${userData.userId})\n`;
        content += `CURRENT STANDING: ✅ ${userData.positiveRep || 0} | ❌ ${userData.negativeRep || 0}\n`;
        content += `GENERATED: ${new Date().toISOString()}\n`;
        content += `--------------------------------------------------\n\n`;

        if (!userData.reputationHistory || userData.reputationHistory.length === 0) {
            content += "No history recorded.";
        } else {
            [...userData.reputationHistory].reverse().forEach(log => {
                const date = new Date(log.timestamp).toLocaleString();
                content += `[${date}] ACTION: ${log.action}\n`;
                content += `  > Amount: ${log.amount}\n`;
                content += `  > Mod ID: ${log.moderatorId}\n`;
                content += `  > Reason: ${log.reason}\n\n`;
            });
        }

        return new AttachmentBuilder(Buffer.from(content, 'utf-8'), { name: `history_${username}_${Date.now()}.txt` });
    }
}