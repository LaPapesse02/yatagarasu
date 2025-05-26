import { ChatInputCommandInteraction, MessageFlags } from "discord.js"
import { generateResultListEmbed, SEARCHING_EMBED } from "./embeds"
import type { RequestResult } from "./@types/discord.t"


const MAX_RESULT_LIST_LENGTH = 10
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

    const results: any = await getSearchResultList(
        interaction.options.getString('series')!,
        interaction.options.getBoolean('allow_explicit') ?? true
    )

    const parsedResults = await parseResultList(results.results as object[]);
    const resultEmbed = generateResultListEmbed(parsedResults);

    interaction.editReply({ embeds: [ resultEmbed ] });
}

const getSearchResultList = async (query: string, allowExplicit: boolean): Promise<object> => {
    const requestBody = {
        search: query,
        exclude_genre: [] as string[]
    };
    if (!allowExplicit) {
        requestBody.exclude_genre.push('Hentai');
    }

    const response = await fetch(SEARCH_SERIES_API, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { "Content-Type": "application/json" }
    });

    return await response.json() as object;
}

const parseResultList = async (results: any[]) => {
    const parsedResults = [] as RequestResult[];

    results.slice(0, MAX_RESULT_LIST_LENGTH).forEach(result => {
        parsedResults.push({
            id: result.record.series_id,
            title: result.record.title,
            year: result.record.year
        })
    });

    return parsedResults;
}
