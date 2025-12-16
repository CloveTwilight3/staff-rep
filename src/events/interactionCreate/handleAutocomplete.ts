import { Interaction } from 'discord.js';
import { IEvent } from '../../core/IEvent';
import { CustomClient } from '../../types';

// FIXED: Added <'interactionCreate'> generic
const autocompleteEvent: IEvent<'interactionCreate'> = {
    name: 'interactionCreate',
    execute: async (interaction: Interaction, client: CustomClient) => {
        if (!interaction.isAutocomplete()) return;
        
        const command = client.commands.get(interaction.commandName);
        
        if (command && command.autocomplete) {
            try {
                await command.autocomplete(interaction, client);
            } catch (error) {
                console.error("Autocomplete failed:", error);
            }
        }
    }
};

export default autocompleteEvent;