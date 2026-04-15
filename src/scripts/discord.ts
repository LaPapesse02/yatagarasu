import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Client, ContainerBuilder, EmbedBuilder, InteractionCallbackResponse, MediaGalleryBuilder, MessageFlags, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder, TextDisplayBuilder } from "discord.js";
import { getSeries, search } from './mangaupdates';
import { addSeriesSubscription, cacheSeries, checkIfUserSubscribed, getCachedSeries, getUserSubscriptions, removeSeriesSubscription } from "./database";
import { Series, SubscribedSeriesCache } from "../@types/database.t";


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
        const seriesInfo = await getCachedOrRequestSeries(seriesId);
        const seriesMessage = await generateSeriesContent(seriesInfo);
        // temporary component that will be removed once inside the next loop
        seriesMessage.addSectionComponents(new SectionBuilder())
        
        while (true) {
            const userSubscribed = await checkIfUserSubscribed(commandInteraction.user.id, seriesId);
            const buttons = await generateSeriesButtons(commandInteraction.user.id, seriesId, seriesInfo?.url!, userSubscribed);

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
            else if (responseInteraction?.customId.startsWith('sub'))
                await addSeriesSubscription(commandInteraction.user.id, seriesId);
            else if (responseInteraction?.customId.startsWith('unsub'))
                await removeSeriesSubscription(commandInteraction.user.id, seriesId);
            
            responseInteraction?.deferUpdate();
        }
    }
}

/**
 * creates the message containing the info about a series
 * 
 * @param series - the response from the mangaupdates api
 */
const generateSeriesContent = async (series: Series) => {
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
    series.authors?.forEach((author) => {
        if (authors.has(author.name))
            authors.get(author.name)?.push(author.role);
        else
            authors.set(author.name, [ author.role ]);
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
        (thumbnail) => thumbnail.setURL(series.image_url)
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
    const genresText = `**Genres:**\n${series.genres?.map((genre) => genre.genre).join(', ')}`;
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

export const subscriptionsCommand = async (interaction: ChatInputCommandInteraction) => {
    const response = await interaction.reply({ embeds: [ SEARCHING_EMBED ], withResponse: true });
    const subscribedSeries = await getUserSubscriptions(interaction.user.id);
    const cachedSubscriptions: SubscribedSeriesCache[] = subscribedSeries.map((series) => ({ series_id: series.series_id }));

    if (cachedSubscriptions.length === 0)
        return;

    await subscriptionLoop(interaction, response, cachedSubscriptions);
}

const subscriptionLoop = async (
    interaction: ChatInputCommandInteraction,
    response: InteractionCallbackResponse<boolean>,
    subscriptions: SubscribedSeriesCache[]
) => {
    const collectorFilter = (i: any) => i.user.id === interaction.user.id;
    let index = 0;
    let message;
    let buttons;
    while (true) {
        if (!subscriptions[index].series_info)
            subscriptions[index].series_info = await getCachedOrRequestSeries(subscriptions[index].series_id);
        
        message = await generateSeriesContent(subscriptions[index].series_info!);
        buttons = await createSubscriptionButtons(
            index === 0,
            index === subscriptions.length - 1,
            await checkIfUserSubscribed(interaction.user.id, subscriptions[index].series_id),
            subscriptions[index].series_id
        )
        message.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons))
        interaction.editReply({ embeds: [], components: [ message ], flags: MessageFlags.IsComponentsV2 })

        let responseInteraction;
        try {
            responseInteraction = await response.resource?.message?.awaitMessageComponent({ filter: collectorFilter, time: INTERACTION_TIMEOUT });
            
        } catch (error) {
            message.spliceComponents(
                message.components.length - 1, 
                1,
                new TextDisplayBuilder().setContent(`*Interaction timed out after ${INTERACTION_TIMEOUT / 1_000}s*`)
            );
            interaction.editReply({ components: [ message ], flags: MessageFlags.IsComponentsV2 })
            return;
        }

        if (responseInteraction?.customId === 'prev')
            index--;
        else if (responseInteraction?.customId === 'next')
            index++;
        else if (responseInteraction?.customId === 'reload') {
            const subscribedSeries = await getUserSubscriptions(interaction.user.id);
            subscriptions = subscribedSeries.map((series) => ({ series_id: series.series_id }));
            index = 0;
        } else if (responseInteraction?.customId.startsWith('sub'))
            await addSeriesSubscription(interaction.user.id, subscriptions[index].series_id);
        else if (responseInteraction?.customId.startsWith('unsub'))
            await removeSeriesSubscription(interaction.user.id, subscriptions[index].series_id);

        responseInteraction?.deferUpdate();
    }
}

const createSubscriptionButtons = async (isFirst: boolean, isLast: boolean, isSubscribed: boolean, seriesId: string | number) => {
    const prevButton = new ButtonBuilder().setCustomId('prev').setLabel('<').setStyle(ButtonStyle.Secondary).setDisabled(isFirst);
    let subButton;
    const reloadButton = new ButtonBuilder().setCustomId('reload').setLabel('⟳').setStyle(ButtonStyle.Secondary);
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
    const nextButton = new ButtonBuilder().setCustomId('next').setLabel('>').setStyle(ButtonStyle.Secondary).setDisabled(isLast);

    return [ prevButton, subButton, reloadButton, nextButton ]
}

const notificationMessage = async (seriesList: Series[]) => {
    const updates = [];

    for (let series of seriesList) {
        const container = new ContainerBuilder();
        
        const section = new SectionBuilder()
        const title = new TextDisplayBuilder().setContent(`# ${series.title} (${series.year})`);
        const description = new TextDisplayBuilder().setContent(`c.${series.latest_chapter} released!`);

        section.addTextDisplayComponents(title);
        section.addTextDisplayComponents(description);
        section.setThumbnailAccessory(thumbnail => thumbnail.setURL(series.image_url));

        container.addSectionComponents(section);

        updates.push(container);
    }

    return updates;
}

export const notifyUsers = async (client: Client, notificationList: Map<string, Series[]>) => {
    for (let [id, seriesList] of notificationList) {
        const user = await client.users.fetch(id);
        const message = await notificationMessage(seriesList);

        await user.send({ components: message, files: [ NO_IMAGE_ATTACHMENT ], flags: MessageFlags.IsComponentsV2 });
    }
}

const getCachedOrRequestSeries = async (seriesId: string | number) => {
    const cachedSeries = await getCachedSeries(seriesId);

    if (cachedSeries && Date.now() - cachedSeries.last_modified.getTime() < 7 * 24 * 60 * 60 * 1000)
        return cachedSeries;

    const series = await getSeries(seriesId);
    cacheSeries(series!);
    return series!; 
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