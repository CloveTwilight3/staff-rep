import { ApplicationCommandOptionType, CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { IApplicationCommand } from '../../core/IApplicationCommand';
import { CustomClient } from '../../types';
import { StaffLogic } from '../../utils/StaffLogic';

const devExport: IApplicationCommand = {
    data: {
        name: 'dev',
        description: 'Developer tools.',
        options: [
            {
                name: 'export',
                description: 'Export staff history.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'user', description: 'Target user (optional).', type: ApplicationCommandOptionType.User, required: false }
                ]
            }
        ]
    },
    permissions: 'admin',
    defaultMemberPermissions: PermissionFlagsBits.Administrator,

    async execute(interaction: CommandInteraction, client: CustomClient) {
        if (!interaction.isChatInputCommand()) return;
        
        if (!StaffLogic.isAuthorized(interaction.member as any)) {
            return interaction.reply({ content: "❌ Authorized Developers Only.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');

        if (targetUser) {
            const userData = await client.database.getUser(targetUser.id);
            if (!userData) return interaction.editReply("No data found for this user.");
            
            const file = StaffLogic.generateExport(userData, targetUser.username);
            await interaction.editReply({ files: [file] });
        } else {
            await interaction.editReply("⚠️ Bulk export processing...");
            const allStaff = await client.database.getLeaderboard('positiveRep', 100); 
            
            if (allStaff.length > 20) return interaction.editReply("Too many staff to bulk export here. Please request individual users.");
            
            const files = [];
            for (const data of allStaff) {
                const u = await client.users.fetch(data.userId).catch(() => null);
                if (u) files.push(StaffLogic.generateExport(data, u.username));
            }
            await interaction.editReply({ content: "✅ Bulk Export:", files: files });
        }
    }
};

export default devExport;