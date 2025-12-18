import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { searchCommand } from '../../scripts/discord';


export const data = new SlashCommandBuilder()
    .setName('search')
    .setDescription('Searches a series on MangaUpdates')
    .addStringOption((option) => 
        option.setName('name')
            .setDescription('The name of the series to search')
            .setRequired(true)
    );
    
export async function execute(interaction: ChatInputCommandInteraction) {
    await searchCommand(interaction);
}
