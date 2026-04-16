import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextDisplayBuilder } from "discord.js"
import { Series } from "../@types/database.t";


const MAX_TITLE_LENGTH = 50;

export const NO_IMAGE_ATTACHMENT = new AttachmentBuilder('./resources/no_image.jpg');

export const LOADING_MESSAGE = (() => {
    let container = new ContainerBuilder();
    let text = new TextDisplayBuilder().setContent('### Loading…');

    container.addTextDisplayComponents(text);

    return container;
})()
export const ERROR_MESSAGE = (() => {
    let container = new ContainerBuilder();
    let text = new TextDisplayBuilder().setContent('### An error occurred while searching!');

    container.setAccentColor(0xC80000); // sets the accent color to red
    container.addTextDisplayComponents(text);

    return container;
})()
export const NO_RESULTS_MESSAGE = (() => {
    let container = new ContainerBuilder();
    let text = new TextDisplayBuilder().setContent('### No results were found!');

    container.setAccentColor(0xC80000); // sets the accent color to red
    container.addTextDisplayComponents(text);

    return container;
})()
export const NO_SUBSCRIPTIONS_MESSAGE = (() => {
    let container = new ContainerBuilder();
    let text = new TextDisplayBuilder().setContent('### You aren\'t subscribed to any series!');

    container.setAccentColor(0xC80000); // sets the accent color to red
    container.addTextDisplayComponents(text);

    return container;
})()

/**
 * creates the display component that will show the results of the search
 * command ran by the user. 
 * 
 * @param results - the response given by the mangaupdates api
 */
export const createSearchResultMessage = (results: any[]) => {
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
 * creates the message containing the info about a series
 * 
 * @param series - the response from the mangaupdates api
 */
export const createSeriesMessage = (series: Series) => {
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
 * @param seriesUrl - the link to the mangaupdates page of the series
 * @param isSubscribed - whether the user is subscribed to this series or not
 */
export const createSeriesButtons = (seriesUrl: string, isSubscribed: boolean) => {
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
            .setCustomId(`unsub`)
            .setLabel('Unubscribe!')
            .setStyle(ButtonStyle.Danger);
    else
        subButton = new ButtonBuilder()
            .setCustomId(`sub`)
            .setLabel('Subscribe!')
            .setStyle(ButtonStyle.Primary);
    
    const linkButton = new ButtonBuilder()
        .setURL(seriesUrl)
        .setLabel('View on MangaUpdates')
        .setStyle(ButtonStyle.Link)

    
    return new ActionRowBuilder<ButtonBuilder>().addComponents([ backButton, subButton, linkButton ]);
}

/**
 * creates the display components that will show the series that
 * were updated
 * 
 * @param seriesList 
 */
export const createUpdateMessage = (seriesList: Series[]) => {
    // discord messages can have up to 40 components and each
    // series' message uses 4 components, so we separate the components
    // in groups of 10 to send them each in its own message
    const numberOfMessages = Math.floor(seriesList.length / 10) + 1;
    const updates = Array<ContainerBuilder[]>(numberOfMessages).fill([]);

    for (let [i, series] of seriesList.entries()) {
        const container = new ContainerBuilder();
        
        const section = new SectionBuilder()
        const text = new TextDisplayBuilder().setContent(
            `# ${series.title} (${series.year})\nc.${series.latest_chapter} released!`
        );

        section.addTextDisplayComponents(text);
        section.setThumbnailAccessory(thumbnail => thumbnail.setURL(series.image_url));

        container.addSectionComponents(section);

        updates[i/4].push(container);
    }

    return updates;
}

export const createSubscriptionsButtons = (isFirst: boolean, isLast: boolean, seriesUrl: string) => {
    const prevButton = new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('<')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(isFirst);
    const unsubButton = new ButtonBuilder()
        .setCustomId(`unsub`)
        .setLabel('Unubscribe!')
        .setStyle(ButtonStyle.Danger);
    const linkButton = new ButtonBuilder()
        .setURL(seriesUrl)
        .setLabel('View on MangaUpdates')
        .setStyle(ButtonStyle.Link)
    const nextButton = new ButtonBuilder()
        .setCustomId('next')
        .setLabel('>')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(isLast);

    return new ActionRowBuilder<ButtonBuilder>().addComponents([ prevButton, unsubButton, linkButton, nextButton ]);
}

/**
 * removes the action row at the end of the component and replaces 
 * it with a message showing after how much time the interaction
 * timed out
 * 
 * @param originalMessage - the message to be modified
 * @param timeoutTime - the message after the action row was removed
 */
export const timeoutInteraction = (originalMessage: ContainerBuilder, timeoutTime: number) => {
    const timeoutMessage = new TextDisplayBuilder().setContent(`*Interaction timed out after ${timeoutTime / 1_000}s*`);
    const newMessage = originalMessage.spliceComponents(originalMessage.components.length - 1, 1, timeoutMessage);

    return newMessage;
}

/**
 * shortens the string when it's longer than the limit and if it does
 * adds '…' at the end to show that it was truncated.
 * 
 * @param text - the text to shorten
 * @param maxLength - the point at which the text will be truncated
 */
const shortenString = (text: string, maxLength: number) => {
    if (text.length <= maxLength)
        return text;
    
    return `${text.slice(0, maxLength)}…`;
} 
