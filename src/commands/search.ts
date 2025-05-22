import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";


export const data = new SlashCommandBuilder()
    .setName('search')
    .setDescription('Searches a manga')

    .addBooleanOption(option =>
        option.setName('ephemeral')
            .setDescription('Make the search only visible to you')
            .setRequired(false)
    );

export const execute = async (interaction: ChatInputCommandInteraction) => {
    
};