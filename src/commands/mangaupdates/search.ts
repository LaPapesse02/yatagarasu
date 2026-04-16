import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { searchCommand } from '../../scripts/discord/search';


export const data = new SlashCommandBuilder()
    .setName('search')
    .setDescription('Searches a series on MangaUpdates')
    .addStringOption((option) => 
        option.setName('name')
            .setDescription('The name of the series to search')
            .setRequired(true)
    )
    .addBooleanOption((option) => 
        option.setName('allow_nsfw')
            .setDescription('Whether to allow NSFW or not')
    )
    .addBooleanOption((option) => 
        option.setName('allow_doujinshi')
            .setDescription('Whether to allow doujinshi or not')
    )
    .addBooleanOption((option) => 
        option.setName('ephemeral')
            .setDescription('Make this message invisible to other people')
    );
    
export async function execute(interaction: ChatInputCommandInteraction) {
    await searchCommand(interaction);
}
