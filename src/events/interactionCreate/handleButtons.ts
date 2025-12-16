import { Interaction, GuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { IEvent } from '../../core/IEvent';
import { CustomClient, UserData } from '../../types';
import { StaffLogic, staffConfig } from '../../utils/StaffLogic';

const handleButtons: IEvent<'interactionCreate'> = {
    name: 'interactionCreate',
    execute: async (interaction: Interaction, client: CustomClient) => {
        if (!interaction.isButton()) return;
        const { customId } = interaction;

        // 1. Authorization Check
        if (!StaffLogic.isAuthorized(interaction.member as GuildMember)) {
            await interaction.reply({ content: "❌ You are not authorized to manage staff requests.", ephemeral: true });
            return;
        }

        // 2. Defer (Ephemeral)
        await interaction.deferReply({ ephemeral: true });

        // --- PROMOTION / DEMOTION LOGIC ---
        if (customId.startsWith('BTN_APPROVE_REQ_')) {
            const [, , , targetId, type] = customId.split('_'); 
            const member = await interaction.guild?.members.fetch(targetId).catch(() => null);
            
            if (!member) {
                await interaction.editReply("❌ Member not found or has left the guild.");
                return;
            }

            const result = await StaffLogic.processRankChange(client, member, type as 'PROMO' | 'DEMO', interaction.user);
            
            // Cleanup original request
            if (interaction.message.deletable) await interaction.message.delete();
            
            await interaction.editReply(result);
            
            const logChannel = await client.channels.fetch(staffConfig.channels.log) as TextChannel;
            if (logChannel) logChannel.send(result);
        }
        
        else if (customId.startsWith('BTN_DENY_REQ_')) {
            if (interaction.message.deletable) await interaction.message.delete();
            await interaction.editReply("✅ Request denied. Points remain unchanged.");
        }

        // --- LOA LOGIC ---
        else if (customId.startsWith('BTN_LOA_APPROVE_')) {
            const targetId = customId.split('_')[3];
            
            // Fetch the target user object to get their avatar for the embed
            const targetUser = await client.users.fetch(targetId).catch(() => null);
            
            // Try to extract original reason
            let originalReason = "Approved by Management";
            if (interaction.message.embeds.length > 0) {
                const fields = interaction.message.embeds[0].fields;
                const reasonField = fields.find(f => f.name.includes('Reason'));
                if (reasonField) {
                    originalReason = reasonField.value.replace(/`/g, '');
                } else {
                    const desc = interaction.message.embeds[0].description || "";
                    const match = desc.match(/\*\*Reason:\*\* (.*)/);
                    if (match) originalReason = match[1];
                }
            }

            // Update DB
            await client.database.updateUser(targetId, {
                loaStatus: { isActive: true, since: Date.now(), reason: originalReason }
            });

            // 1. Remove Buttons (Visual Lock)
            await interaction.message.edit({ components: [] });

            // 2. Send PROFESSIONAL REPLY (Matching the Request Style)
            const approvalEmbed = new EmbedBuilder()
                .setTitle('✅ Formal LOA Approval')
                .setColor(0x00FF00) // Success Green
                .setThumbnail(targetUser?.displayAvatarURL() || null)
                .addFields(
                    { name: '👤 Staff Member', value: `<@${targetId}>`, inline: true },
                    { name: '🛡️ Authorized By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📅 Effective Date', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false },
                    { name: '📝 Reason Logged', value: `\`\`\`${originalReason}\`\`\``, inline: false }
                )
                .setFooter({ text: 'Status: Active • Staff Management System' })
                .setTimestamp();

            if (interaction.channel?.isSendable()) {
                 await interaction.message.reply({ embeds: [approvalEmbed] });
            }

            // 3. Confirm to Manager
            await interaction.editReply(`✅ You approved the LOA for <@${targetId}>.`);

            // 4. DM The User
            if (targetUser) {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('✅ LOA Request Approved')
                    .setDescription(`Your Leave of Absence request has been approved by <@${interaction.user.id}>, we wish you a nice break and safe return.`)
                    .addFields(
                        { name: 'Reason Logged', value: originalReason },
                    )
                    .setColor(0x00FF00)
                    .setFooter({ text: 'Use /loa return when you are back!' });
                    
                await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
            }
        }

        else if (customId.startsWith('BTN_LOA_DENY_')) {
             const targetId = customId.split('_')[3];
             const targetUser = await client.users.fetch(targetId).catch(() => null);

             // 1. Remove Buttons
             await interaction.message.edit({ components: [] });
             
             // 2. Send PROFESSIONAL REPLY (Denied)
             const denialEmbed = new EmbedBuilder()
                .setTitle('⛔ LOA Request Denied')
                .setColor(0xFF0000) // Red
                .setThumbnail(targetUser?.displayAvatarURL() || null)
                .addFields(
                    { name: '👤 Staff Member', value: `<@${targetId}>`, inline: true },
                    { name: '🛡️ Denied By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📅 Date', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false }
                )
                .setFooter({ text: 'Status: Denied • Staff Management System' })
                .setTimestamp();

             if (interaction.channel?.isSendable()) {
                 await interaction.message.reply({ embeds: [denialEmbed] });
             }

             // 3. Confirm to Manager
             await interaction.editReply("✅ You denied the request.");
             
             // 4. DM User
             if(targetUser) targetUser.send("❌ Your LOA request was **denied** by management.").catch(() => {});
        }

        // --- MASS PROCESS ---
        else if (customId === 'BTN_MASS_PROCESS') {
            const allUsers = await client.database.getLeaderboard('positiveRep', 100);
            
            const eligible = allUsers.filter((u: UserData) => (u.positiveRep || 0) >= 10 || (u.negativeRep || 0) >= 10);
            
            let report = "Processing Report:\n";
            
            for (const u of eligible) {
                const member = await interaction.guild?.members.fetch(u.userId).catch(() => null);
                if (member) {
                    const type = (u.positiveRep || 0) >= 10 ? 'PROMO' : 'DEMO';
                    const res = await StaffLogic.processRankChange(client, member, type, interaction.user);
                    report += `${res}\n`;
                }
            }
            
            await interaction.editReply(report.substring(0, 2000));
        }
    }
};

export default handleButtons;