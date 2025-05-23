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

const getSearchResultList = async (query: string, allowExplicit: boolean) => {
    const requestBody = {
        search: query,
        exclude_genre: [] as string[]
    };
    if (!allowExplicit) {
        requestBody.exclude_genre.push('Hentai');
    }

    const response = await fetch(SEARCH_SERIES_API, {
        method: 'POST',
        body: JSON.stringify(requestBody)
    });

    return await response.json();
}