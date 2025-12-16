import { ApplicationCommandOptionType, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { IApplicationCommand } from '../../core/IApplicationCommand';
import { CustomClient } from '../../types';
import { staffConfig } from '../../utils/StaffLogic';

const checkReputation: IApplicationCommand = {
    data: {
        name: 'checkrep',
        description: 'View reputation stats for a staff member.',
        options: [
            {
                name: 'user',
                description: 'The staff member to check.',
                type: ApplicationCommandOptionType.User,
                required: true
            }
        ]
    },
    permissions: 'admin',
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,

    async execute(interaction: CommandInteraction, client: CustomClient) {
        if (!interaction.isChatInputCommand()) return;
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user', true);

        const targetMember = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return interaction.editReply("❌ User not found in this server.");
        }

        const sortedHierarchy = [...staffConfig.roles.staffHierarchy].sort((a: any, b: any) => b.rank - a.rank);
        
        const currentRoleConfig = sortedHierarchy.find((role: any) => targetMember.roles.cache.has(role.id));

        if (!currentRoleConfig) {
            return interaction.editReply(`❌ **Invalid Target:** <@${targetUser.id}> is not a recognized staff member.`);
        }

        const userData = await client.database.getOrCreateUser(targetUser.id);

        const pos = userData.positiveRep || 0;
        const neg = userData.negativeRep || 0;
        const loa = userData.loaStatus?.isActive ? `✅ Active (Since: ${new Date(userData.loaStatus.since || 0).toLocaleDateString()})` : '❌ Inactive';

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Staff Report: ${targetUser.username}`)
            .setColor(0x3498db)
            .addFields(
                { name: 'Current Position', value: `🏆 **${currentRoleConfig.name}**`, inline: false },
                { name: 'Positive Points', value: `✅ ${pos}`, inline: true },
                { name: 'Negative Strikes', value: `❌ ${neg}`, inline: true },
                { name: 'LOA Status', value: loa, inline: false }
            )
            .setThumbnail(targetUser.displayAvatarURL());

        if (userData.reputationHistory && userData.reputationHistory.length > 0) {
            const lastThree = [...userData.reputationHistory].reverse().slice(0, 3);
            const historyText = lastThree.map(log => 
                `\`${log.action}\`: ${log.reason} (<@${log.moderatorId}>)`
            ).join('\n');
            embed.addFields({ name: 'Recent History', value: historyText });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};

export default checkReputation;