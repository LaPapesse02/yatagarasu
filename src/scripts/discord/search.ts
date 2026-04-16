import { ChatInputCommandInteraction, ComponentType, InteractionCallbackResponse, MessageFlags, SeparatorBuilder } from "discord.js";
import { search } from "../mangaupdates";
import { LOADING_MESSAGE, ERROR_MESSAGE, NO_RESULTS_MESSAGE, createSearchResultMessage, timeoutInteraction, createSeriesMessage, createSeriesButtons } from "./message_creation";
import { addSeriesSubscription, checkIfUserSubscribed, getCachedOrRequestSeries, removeSeriesSubscription } from "../database";


const MAX_SEARCH_RESULTS = 10;
const INTERACTION_TIMEOUT = 60_000; // 1_000 = 1s

/**
 * the function that runs when /seach gets executed by the user
 * 
 * @param interaction - the user interaction
 */
export const searchCommand = async (interaction: ChatInputCommandInteraction) => {
    let flags = MessageFlags.IsComponentsV2;
    
    if (interaction.options.getBoolean('ephemeral'))
        flags = flags + MessageFlags.Ephemeral;

    // immediately respond to the user so that they know the
    // command is working
    const response = await interaction.reply({
        components: [ LOADING_MESSAGE ],
        flags: flags,
        withResponse: true,
    });

    const exclude_nsfw = !interaction.options.getBoolean('allow_nsfw');
    const exclude_doujinshi = !interaction.options.getBoolean('allow_doujinshi');

    // search the user's query on mangaupdates
    const results = await search(
        interaction.options.getString('name')!,
        MAX_SEARCH_RESULTS,
        exclude_nsfw,
        exclude_doujinshi
    );

    // quit if no results were found or if mangaupdates returned an error
    if (results === null) 
        return interaction.editReply({ components: [ ERROR_MESSAGE ] });
    else if (results.length === 0)
        return interaction.editReply({ components: [ NO_RESULTS_MESSAGE ] });

    await showResults(interaction, response, results);
}

/**
 * displays the message with all the results from the user's search
 * 
 * @param interaction - the interaction from when the command was ran
 * @param response - the interaction with the action row in the message
 * @param results - the series that was chosen by the user
 */
const showResults = async (interaction: ChatInputCommandInteraction, response: InteractionCallbackResponse<boolean>, results: any[]) => {
    // filter used to make sure the user interacting with the message
    // is also the user that ran the command
    const interactionFilter = (i: any) => i.user.id === interaction.user.id;

    //create the message to show the results to the user
    const resultsMessage = createSearchResultMessage(results);
    let selection;

    while (true) {
        // show the results to the user with a selection menu to choose
        // which result to view
        interaction.editReply({ components: [ resultsMessage ] });

        try {
            // wait for the user to select a series
            const selectionInteraction = await response.resource?.message?.awaitMessageComponent<ComponentType.StringSelect>({
                filter: interactionFilter,
                time: INTERACTION_TIMEOUT
            });

            selection = selectionInteraction?.values[0]!;
        } catch (error) {
            // remove the buttons if the user doesnt interact for too long
            const timedoutResultsMessage = timeoutInteraction(resultsMessage, INTERACTION_TIMEOUT);
            await interaction.editReply({ components: [ timedoutResultsMessage ] });

            return;
        }

        const shouldLoop = await showSeries(interaction, response, selection);
        if (!shouldLoop) return;
    }
}

/**
 * displays the message with all the series' informations
 * 
 * @param interaction - the interaction from when the command was ran
 * @param response - the interaction with the action row in the message
 * @param selection - the series that was chosen by the user
 */
const showSeries = async (interaction: ChatInputCommandInteraction, response: InteractionCallbackResponse<boolean>, selection: string) => {
    // filter used to make sure the user interacting with the message
    // is also the user that ran the command
    const interactionFilter = (i: any) => i.user.id === interaction.user.id;

    const seriesInfo = await getCachedOrRequestSeries(selection);
    const seriesMessage = createSeriesMessage(seriesInfo);

    // temporary component that will be immediately removed once in the loop
    seriesMessage.addSeparatorComponents(new SeparatorBuilder());
    let buttonInteraction;
    

    while (true) {
        seriesMessage.spliceComponents(
            seriesMessage.components.length -1,
            1,
            createSeriesButtons(seriesInfo.url, await checkIfUserSubscribed(interaction.user.id, selection))
        );

        interaction.editReply({ components: [ seriesMessage ] });

        try {
            // wait for the user to select a series
            buttonInteraction = await response.resource?.message?.awaitMessageComponent<ComponentType.Button>({
                filter: interactionFilter,
                time: INTERACTION_TIMEOUT
            })!;
        } catch (error) {
            // remove the buttons if the user doesnt interact for too long
            const timedoutSeriesMessage = timeoutInteraction(seriesMessage, INTERACTION_TIMEOUT);
            await interaction.editReply({ components: [ timedoutSeriesMessage ] });

            return false;
        }
        
        if (buttonInteraction.customId === 'back') return true;
        else if (buttonInteraction.customId === 'sub')
            await addSeriesSubscription(interaction.user.id, selection);
        else if (buttonInteraction.customId === 'unsub')
            await removeSeriesSubscription(interaction.user.id, selection);
        
        buttonInteraction.deferUpdate();
    }
}
