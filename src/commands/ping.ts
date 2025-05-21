import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";


export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!');

export const execute = async (interaction: ChatInputCommandInteraction) => {
    interaction.reply({
        content: 'Pong!',
        flags: MessageFlags.Ephemeral
    });
};