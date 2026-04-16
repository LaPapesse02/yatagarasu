import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { subscriptionsCommand } from '../../scripts/discord/subscriptions';


export const data = new SlashCommandBuilder()
    .setName('subscriptions')
    .setDescription('See your subscriptions')
    .addBooleanOption((option) => 
        option.setName('ephemeral')
            .setDescription('Make this message invisible to other people')
    );
    
export async function execute(interaction: ChatInputCommandInteraction) {
    await subscriptionsCommand(interaction);
}
