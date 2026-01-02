import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';


export const data = new SlashCommandBuilder()
    .setName('subscriptions')
    .setDescription('See your subscriptions');
    
export async function execute(interaction: ChatInputCommandInteraction) { }
