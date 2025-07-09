import { ChatInputCommandInteraction, ComponentType, EmbedBuilder, InteractionCallbackResponse, MessageFlags } from "discord.js"
import { generateResultListComponents, generateResultListEmbed, SEARCHING_EMBED } from "./embeds"
import type { RequestResult } from "./@types/discord.t"


const MAX_RESULT_LIST_LENGTH = 10
const SEARCH_SERIES_API = 'https://api.mangaupdates.com/v1/series/search'
const SERIES_API = 'https://api.mangaupdates.com/v1/series'
const INTERACTION_TIMEOUT = 60

export const search = async (interaction: ChatInputCommandInteraction) => {
    let response;
    if (interaction.options.getBoolean('ephemeral') ?? true) {
        response = await interaction.reply({
            embeds: [ SEARCHING_EMBED ],
            flags: MessageFlags.Ephemeral,
            withResponse: true
        })
    } else {
        response = await interaction.reply({ embeds: [ SEARCHING_EMBED ], withResponse: true })
    }

    const results: any = await getSearchResultList(
        interaction.options.getString('series')!,
        interaction.options.getBoolean('allow_explicit') ?? true
    )

    const parsedResults = await parseResultList(results.results as object[]);
    const resultEmbed = generateResultListEmbed(parsedResults);
    const selectionRow = generateResultListComponents(parsedResults);

    const a = await interaction.editReply({ embeds: [ resultEmbed ], components: [ selectionRow ] });
    handleInteraction(response, interaction, resultEmbed)
}

const getSearchResultList = async (query: string, allowExplicit: boolean): Promise<object> => {
    const requestBody = {
        search: query,
        exclude_genre: [] as string[]
    };
    if (!allowExplicit) {
        requestBody.exclude_genre.push('Hentai');
        requestBody.exclude_genre.push('Smut');
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

const handleInteraction = async (response: InteractionCallbackResponse, interaction: ChatInputCommandInteraction, originalEmbed: EmbedBuilder) => {
    const collector = response.resource?.message?.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i: any) => i.user.id === interaction.user.id,
        time: INTERACTION_TIMEOUT * 1_000
    })

    collector?.on('collect', async (interaction) => {
        if (interaction.customId === 'result_selection') {
            const seriesInfo = await getSeriesInfo(interaction.values[0]!)
            const parsedInfo = await parseSeriesInfo(seriesInfo)
            // TODO: display series info to user
        }
    })
}

const getSeriesInfo = async (series_id: string) => {
    const response = await fetch(`${SERIES_API}/${series_id}`);

    return await response.json() as object;
}

const parseSeriesInfo = async (response: any) => {
    return {
        id: response.series_id,
        url: response.url,
        title: response.title,
        description: response.description,
        image: response.image.url.original,
        year: response.year,
        authors: response.authors.map((author: any) => { return {name: author.name, type: author.type} }),
        genres: response.genres.map((genre: any) => genre.genre),
        publisher: response.publishers.filter((publisher: any) => { return publisher.type === 'Original' })[0].publisher_name,
        latest_chapter: response.latest_chapter
    }
}
