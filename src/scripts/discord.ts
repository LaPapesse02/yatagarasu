import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ContainerBuilder, EmbedBuilder, InteractionCallbackResponse, MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder, TextDisplayBuilder } from "discord.js";
import { getSeries, search } from './mangaupdates';
import { checkIfUserSubscribed } from "./database";


const MAX_SEARCH_RESULTS = 10;
const MAX_TITLE_LENGTH = 50;
const INTERACTION_TIMEOUT = 60_000; // 1_000 = 1s

const SEARCHING_EMBED = new EmbedBuilder().setTitle('Searching...');
const SEARCH_ERROR_EMBED = new EmbedBuilder().setColor('Red').setTitle('An error occured while searching!');
const NO_IMAGE_ATTACHMENT = new AttachmentBuilder('./resources/no_image.jpg');

export const searchCommand = async (interaction: ChatInputCommandInteraction) => {
    const response = await interaction.reply({ embeds: [ SEARCHING_EMBED ], withResponse: true });

    const searchResults = await search(interaction.options.getString('name')!, MAX_SEARCH_RESULTS);
    if (searchResults === null) 
        return interaction.editReply({ embeds: [ SEARCH_ERROR_EMBED ] });

    const resultComponent = createSearchResultComponent(searchResults);

    await messageInteraction(interaction, response, resultComponent)
}

const messageInteraction = async (commandInteraction: ChatInputCommandInteraction, response: InteractionCallbackResponse<boolean>, resultsMessage: ContainerBuilder) => {
    const collectorFilter = (i: any) => i.user.id === commandInteraction.user.id;

    while (true) {
        commandInteraction.editReply({ embeds: [ ], components: [ resultsMessage ], flags: MessageFlags.IsComponentsV2 })
        let responseInteraction;
        
        try {
            responseInteraction = await response.resource?.message?.awaitMessageComponent({ filter: collectorFilter, time: INTERACTION_TIMEOUT });
        } catch (error) {
            resultsMessage.spliceComponents(
                resultsMessage.components.length - 1, 
                1,
                new TextDisplayBuilder().setContent(`*Interaction timed out after ${INTERACTION_TIMEOUT / 1_000}s*`)
            );
            commandInteraction.editReply({ components: [ resultsMessage ], flags: MessageFlags.IsComponentsV2 })
            return;
        }

        if (responseInteraction?.customId !== 'resultSelection') return;

        const seriesId = (responseInteraction as StringSelectMenuInteraction).values[0];
        const seriesInfo: any = await getSeries(seriesId);
        const seriesMessage = await generateSeriesContent(seriesInfo);
        // temporary component that will be removed once inside the next loop
        seriesMessage.addSectionComponents(new SectionBuilder())
        
        while (true) {
            const userSubscribed = await checkIfUserSubscribed(commandInteraction.user.id, seriesId);
            const buttons = await generateSeriesButtons(commandInteraction.user.id, seriesId, seriesInfo.url, !!userSubscribed.length);

            seriesMessage.spliceComponents(seriesMessage.components.length - 1, 1, new ActionRowBuilder<ButtonBuilder>().addComponents(buttons));
            commandInteraction.editReply({ components: [ seriesMessage ], files: [ NO_IMAGE_ATTACHMENT ], flags: MessageFlags.IsComponentsV2 });

            try {
                responseInteraction = await response.resource?.message?.awaitMessageComponent({ filter: collectorFilter, time: INTERACTION_TIMEOUT });
            } catch (error) {
                seriesMessage.spliceComponents(
                    seriesMessage.components.length - 1, 
                    1,
                    new TextDisplayBuilder().setContent(`*Interaction timed out after ${INTERACTION_TIMEOUT / 1_000}s*`)
                );
                commandInteraction.editReply({ components: [ seriesMessage ], flags: MessageFlags.IsComponentsV2 });
                return;
            }

            if (responseInteraction?.customId === 'back') break;
        }
    }
}

/**
 * creates the message containing the info about a series
 * 
 * @param series - the response from the mangaupdates api
 */
const generateSeriesContent = async (series: any) => {
    // the component that will contain the message
    const container = new ContainerBuilder();
    // the component containing the series' title, release year,
    // authors and image
    const titleSection = new SectionBuilder();

    // sets the title, release year and whether the series is still ongoing
    let titleText = `# ${series.title} (${series.year}${!series.completed ? ', ongoing' : ''})\n`;
    
    // the api gives different roles to the same author in different
    // objects in the array, so we get them all in a single object per author
    const authors = new Map<string, string[]>();
    series.authors.forEach((author: any) => {
        if (authors.has(author.name))
            authors.get(author.name)?.push(author.type);
        else
            authors.set(author.name, [ author.type ]);
    });
    // we then add the authors and their roles to the title section
    titleText = titleText.concat(
        authors
            .entries()
            .map(([author, types]) => `${author} (${types.join(', ')})`)
            .toArray()
            .join(', ')
    );

    titleSection.addTextDisplayComponents(new TextDisplayBuilder().setContent(titleText));
    titleSection.setThumbnailAccessory(
        (thumbnail) => thumbnail.setURL(series.image.url.original ? series.image.url.original : 'attachment://no_image.jpg')
    );

    container.addSectionComponents(titleSection);

    // separate the title section from the description and genres
    container.addSeparatorComponents(new SeparatorBuilder());

    // sometimes series don't have a description on mangaupdates,
    // skips this component in that case
    if (series.description) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(series.description));
        // puts an invisible divider between the description and the genres
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
    }
    const genresText = `**Genres:**\n${series.genres.map((genre: any) => genre.genre).join(', ')}`;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(genresText));

    // adds a divider between the genres and the buttons
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
    
    return container;
}

/**
 * creates the buttons that are shown under a series' info message
 * to go back to the results and subscribe or unsubscribe from a series
 * 
 * @param userId - the discord id of the user
 * @param seriesId - the mangaupdates id of the series
 */
const generateSeriesButtons = async (userId: string | number, seriesId: string | number, seriesUrl: string, isSubscribed: boolean) => {
    // the button that allows to go back to the results
    const backButton = new ButtonBuilder()
        .setCustomId('back')
        .setLabel('<')
        .setStyle(ButtonStyle.Secondary);

    // the button to subscribe or unsubscribe from a series
    let subButton;
    // makes a call to the database to check if the user is subscribed already
    if (isSubscribed)
        subButton = new ButtonBuilder()
            .setCustomId(`unsub_${seriesId}`)
            .setLabel('Unubscribe!')
            .setStyle(ButtonStyle.Danger);
    else
        subButton = new ButtonBuilder()
            .setCustomId(`sub_${seriesId}`)
            .setLabel('Subscribe!')
            .setStyle(ButtonStyle.Primary);
    
    const linkButton = new ButtonBuilder()
        .setURL(seriesUrl)
        .setLabel('View on MangaUpdates')
        .setStyle(ButtonStyle.Link)

    return [ backButton, subButton, linkButton ];
}

/**
 * creates the display component that will show the results of the search
 * command ran by the user. 
 * 
 * @param results - the response given by the mangaupdates api
 */
const createSearchResultComponent = (results: any[]) => {
    // the component that will contain the text and button
    const container = new ContainerBuilder();
    // the menu that will allow the user to choose a result
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('resultSelection')
        .setPlaceholder('Choose Series!');
    // the string that will show the results of the search
    let resultString = '## Search results:\n';

    results.map((result) => result.record).forEach((result, index) => {
        const shortTitle = shortenString(result.title, MAX_TITLE_LENGTH);
        // creates a list in the message that looks like:
        // 1. **series 1** (release year)
        // 2. **series 2** (release year)
        // ...
        // text in between ** ** will be shown as bold
        resultString = resultString.concat('\n', `${index+1}. **${shortTitle}** (${result.year})`);
        // the label for the option in the select menu
        const label = `${index+1}. ${shortTitle} (${result.year})`;
        
        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(label)                                // the value is set to the series' id so that it can be used
                .setValue(`${result.series_id}`)     // later from the interaction to search the series
        );
    })

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(resultString));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
    container.addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));

    return container;
}

/**
 * shortens the string when it's longer than the limit and if it does
 * adds '…' at the end to show that it was truncated.
 */
const shortenString = (text: string, maxLength: number) => {
    if (text.length <= maxLength)
        return text;
    
    return `${text.slice(0, maxLength)}…`;
} 