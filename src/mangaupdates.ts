import { ChatInputCommandInteraction, EmbedBuilder, InteractionCallbackResponse, MessageFlags } from "discord.js"
import { generateResultListComponents, generateResultListEmbed, SEARCHING_EMBED } from "./embeds"
import type { RequestResult } from "./@types/discord.t"


const MAX_RESULT_LIST_LENGTH = 10
const SEARCH_SERIES_API = 'https://api.mangaupdates.com/v1/series/search'
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
    const collectorFilter = (i: any) => i.user.id === interaction.user.id;

    try {
        const confirmation = await response.resource?.message?.awaitMessageComponent({ filter: collectorFilter, time: INTERACTION_TIMEOUT * 1000 });

        if (confirmation!.customId === 'result_selection') {
            // TODO: respond to user selection
        }
    } catch {
        interaction.editReply({embeds: [ originalEmbed.setFooter({ text: `No interaction received within ${INTERACTION_TIMEOUT}s` }) ], components: [] })
    }
}

