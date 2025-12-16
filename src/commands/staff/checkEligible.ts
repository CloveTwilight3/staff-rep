import { CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { IApplicationCommand } from '../../core/IApplicationCommand';
import { CustomClient, UserData } from '../../types';
import { staffConfig } from '../../utils/StaffLogic';

const checkEligible: IApplicationCommand = {
    data: {
        name: 'check_eligible',
        description: 'View staff eligible for promotion/demotion.',
    },
    permissions: 'admin',
    defaultMemberPermissions: PermissionFlagsBits.Administrator,

    async execute(interaction: CommandInteraction, client: CustomClient) {
        if (!interaction.guild) return;
        await interaction.deferReply();

        const allUsers = await client.database.getLeaderboard('positiveRep', 200);
        
        const staffRoleIds = staffConfig.roles.staffHierarchy.map((r: any) => r.id);
        const eligible: UserData[] = [];

        for (const u of allUsers) {
            const pos = u.positiveRep || 0;
            const neg = u.negativeRep || 0;
            
            if (pos < 10 && neg < 10) continue;

            try {
                const member = await interaction.guild.members.fetch(u.userId).catch(() => null);
                
                if (!member || !member.roles.cache.hasAny(...staffRoleIds)) {
                    continue;
                }

                eligible.push(u);
            } catch (error) {
                continue;
            }
        }

        if (eligible.length === 0) {
            return interaction.editReply("✅ No **active** staff members are currently waiting for rank changes.");
        }

        let desc = "";
        
        eligible.forEach((u: UserData) => {
            const pos = u.positiveRep || 0;
            const neg = u.negativeRep || 0;
            let type = "";
            if (pos >= 10) type = "⬆️ PROMO";
            if (neg >= 10) type = "⬇️ DEMO";
            desc += `• <@${u.userId}>: **✅ ${pos} | ❌ ${neg}** (${type})\n`;
        });

        const embed = new EmbedBuilder()
            .setTitle('📋 Eligible Staff for Processing')
            .setDescription(desc)
            .setColor(0x0099ff)
            .setFooter({ text: 'Only showing active staff members.' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('BTN_MASS_PROCESS')
                .setLabel('🚀 Process ALL')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};

export default checkEligible;