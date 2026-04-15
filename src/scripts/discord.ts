import { ActionRowBuilder, ButtonBuilder, ChatInputCommandInteraction, Client, ContainerBuilder, InteractionCallbackResponse, MessageFlags, SectionBuilder, StringSelectMenuInteraction, TextDisplayBuilder } from "discord.js";
import { getSeries, search } from './mangaupdates';
import { addSeriesSubscription, cacheSeries, checkIfUserSubscribed, getCachedSeries, getUserSubscriptions, removeSeriesSubscription } from "./database";
import { Series, SubscribedSeriesCache } from "../@types/database.t";
import { createSearchResultMessage, createSeriesButtons, createSeriesMessage, createUpdateButtons, createUpdateMessage, ERROR_MESSAGE, LOADING_MESSAGE, NO_IMAGE_ATTACHMENT, NO_RESULTS_MESSAGE } from "./message_creation";


const MAX_SEARCH_RESULTS = 10;
const INTERACTION_TIMEOUT = 60_000; // 1_000 = 1s

export const searchCommand = async (interaction: ChatInputCommandInteraction) => {
    const response = await interaction.reply({ components: [ LOADING_MESSAGE ], flags: MessageFlags.IsComponentsV2, withResponse: true });

    const searchResults = await search(interaction.options.getString('name')!, MAX_SEARCH_RESULTS);
    if (searchResults === null) 
        return interaction.editReply({ components: [ ERROR_MESSAGE ], flags: MessageFlags.IsComponentsV2 });
    else if (searchResults.length === 0)
        return interaction.editReply({ components: [ NO_RESULTS_MESSAGE ], flags: MessageFlags.IsComponentsV2 })

    const resultComponent = createSearchResultMessage(searchResults);

    await messageInteraction(interaction, response, resultComponent)
}

const messageInteraction = async (commandInteraction: ChatInputCommandInteraction, response: InteractionCallbackResponse<boolean>, resultsMessage: ContainerBuilder) => {
    const collectorFilter = (i: any) => i.user.id === commandInteraction.user.id;

    while (true) {
        commandInteraction.editReply({ components: [ resultsMessage ], flags: MessageFlags.IsComponentsV2 })
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
        const seriesMessage = createSeriesMessage(seriesInfo);
        // temporary component that will be removed once inside the next loop
        seriesMessage.addSectionComponents(new SectionBuilder())
        
        while (true) {
            const userSubscribed = await checkIfUserSubscribed(commandInteraction.user.id, seriesId);
            const buttons = createSeriesButtons(seriesInfo?.url!, userSubscribed);

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

export const subscriptionsCommand = async (interaction: ChatInputCommandInteraction) => {
    const response = await interaction.reply({ components: [ LOADING_MESSAGE ], flags: MessageFlags.IsComponentsV2, withResponse: true });
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
        
        message = createSeriesMessage(subscriptions[index].series_info!);
        buttons = createUpdateButtons(
            index === 0,
            index === subscriptions.length - 1,
            await checkIfUserSubscribed(interaction.user.id, subscriptions[index].series_id),
        )
        message.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons))
        interaction.editReply({ components: [ message ], flags: MessageFlags.IsComponentsV2 })

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

export const notifyUsers = async (client: Client, notificationList: Map<string, Series[]>) => {
    for (let [id, seriesList] of notificationList) {
        const user = await client.users.fetch(id);
        const messages = createUpdateMessage(seriesList);

        for (let message of messages) 
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