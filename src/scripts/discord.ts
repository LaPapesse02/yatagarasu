import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Client, ContainerBuilder, EmbedBuilder, MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextDisplayBuilder } from "discord.js";
import { getSeries, search } from './mangaupdates';
import { client } from '../index';
import { checkIfUserSubscribed } from "./database";


const MAX_SEARCH_RESULTS = 10;
const MAX_TITLE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 500;

const SEARCHING_EMBED = new EmbedBuilder().setTitle('Searching...');
const SEARCH_ERROR_EMBED = new EmbedBuilder().setColor('Red').setTitle('An error occured while searching!');

export const searchCommand = async (interaction: ChatInputCommandInteraction) => {
    const response = await interaction.reply({ embeds: [ SEARCHING_EMBED ], withResponse: true });

    const searchResults = await search(interaction.options.getString('name')!, MAX_SEARCH_RESULTS);
    if (searchResults === null) 
        return interaction.editReply({ embeds: [ SEARCH_ERROR_EMBED ] });

    const resultComponent = createSearchResultComponent(searchResults);
    interaction.editReply({ embeds: [ ], components: [ resultComponent ], flags: MessageFlags.IsComponentsV2 })

    const collectorFilter = (i: any) => i.user.id === interaction.user.id;
    let series;

    try {
        const selection = await response.resource?.message?.awaitMessageComponent({ filter: collectorFilter });
        series = await generateSeriesContent(selection?.values[0]);
        series.addActionRowComponents(await generateSeriesButtons(interaction.user.id, selection?.values[0]))
    } catch {
        console.log('error')
    }

    interaction.editReply({ components: [ series ] })
}

export const generateSeriesContent = async (selection: any) => {
    const series = await getSeries(selection);

    const container = new ContainerBuilder();
    const titleSection = new SectionBuilder();
    titleSection.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${series.title} (${series.year}${!series.completed ? ', ongoing' : ''})`))

    const authors = new Map<string, [string]>();
    series.authors.forEach((author: any) => {
        if (authors.has(author.name))
            authors.get(author.name)?.push(author.type);
        else
            authors.set(author.name, [ author.type ]);
    })
    
    titleSection.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        authors
            .entries()
            .map(([author, types]) => `${author} (${types.join(', ')})`)
            .toArray()
            .join(', ')
    ))

    titleSection.setThumbnailAccessory((thumbnail) => 
        thumbnail.setURL(series.image.url.original)
    )

    container.addSectionComponents(titleSection);

    container.addSeparatorComponents(new SeparatorBuilder())
    if (series.description) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(series.description))
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(false))
    }
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`\n**Genres:**\n${series.genres.map(genre => genre.genre).join(', ')}`))
    container.addSeparatorComponents(new SeparatorBuilder())
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false))
    
    return container;
}

const generateSeriesButtons = async (userId: string | number, seriesId: string | number) => {
    const backButton = new ButtonBuilder().setCustomId('back').setLabel('<').setStyle(ButtonStyle.Secondary)
    //console.log(seriesUrl)
    //const siteButton = new ButtonBuilder().setLabel('View on MangaUpdates').setURL(seriesUrl).setStyle(ButtonStyle.Link)
    let subButton;
    const userSubscribed = await checkIfUserSubscribed(userId, seriesId);
    if (userSubscribed.length)
        subButton = new ButtonBuilder().setCustomId(`unsub_${seriesId}`).setLabel('Unubscribe!').setStyle(ButtonStyle.Danger);
    else
        subButton = new ButtonBuilder().setCustomId(`sub_${seriesId}`).setLabel('Subscribe!').setStyle(ButtonStyle.Primary);

    return new ActionRowBuilder().setComponents(backButton, subButton)
}

const createSearchResultComponent = (results: [any]) => {
    const container = new ContainerBuilder();
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('resultSelection')
        .setPlaceholder('Choose Series!')
    let resultString = '## Search results:\n';

    for (let i = 0; i < results.length; i++) {
        resultString = resultString.concat('\n', `${i+1}. **${shortenString(results[i].record.title, MAX_TITLE_LENGTH)}** (${results[i].record.year})`)
        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(`${i+1}. ${shortenString(results[i].record.title, MAX_TITLE_LENGTH)} (${results[i].record.year})`)
                .setValue(`${results[i].record.series_id}`)
        )
    }

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(resultString));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));

    return container
}

const shortenString = (text: string, maxLength: number) => {
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength)}…`
} 