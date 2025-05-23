import { ChatInputCommandInteraction, MessageFlags } from "discord.js"
import { SEARCHING_EMBED } from "./embeds"


const SEARCH_SERIES_API = 'https://api.mangaupdates.com/v1/series/search'

export const search = async (interaction: ChatInputCommandInteraction) => {
    if (interaction.options.getBoolean('ephemeral') ?? true) {
        interaction.reply({
            embeds: [ SEARCHING_EMBED ],
            flags: MessageFlags.Ephemeral
        })
    } else {
        interaction.reply({ embeds: [ SEARCHING_EMBED ] })
    }
}
