import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { subscriptionsCommand } from '../../scripts/discord';


export const data = new SlashCommandBuilder()
    .setName('subscriptions')
    .setDescription('See your subscriptions');
    
export async function execute(interaction: ChatInputCommandInteraction) {
    await subscriptionsCommand(interaction);
}
