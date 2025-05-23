import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { search } from "../mangaupdates";


export const data = new SlashCommandBuilder()
    .setName('search')
    .setDescription('Searches a manga')

    .addStringOption(option => 
        option.setName('series')
            .setDescription('The series to search')
            .setRequired(true)
    )

    .addBooleanOption(option =>
        option.setName('allow_explicit')
            .setDescription('Allow hentai in the search results')
            .setRequired(false)
    )

    .addBooleanOption(option =>
        option.setName('ephemeral')
            .setDescription('Make the search only visible to you')
            .setRequired(false)
    );

export const execute = async (interaction: ChatInputCommandInteraction) => {
    await search(interaction);
};