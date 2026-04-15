import { ActionRowBuilder, ButtonBuilder, ChatInputCommandInteraction, Client, InteractionCallbackResponse, MessageFlags, TextDisplayBuilder } from "discord.js";
import { addSeriesSubscription, checkIfUserSubscribed, getCachedOrRequestSeries, getUserSubscriptions, removeSeriesSubscription } from "./database";
import { Series, SubscribedSeriesCache } from "../@types/database.t";
import { createSeriesMessage, createUpdateButtons, createUpdateMessage, LOADING_MESSAGE, NO_IMAGE_ATTACHMENT } from "./message_creation";


const INTERACTION_TIMEOUT = 60_000; // 1_000 = 1s


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
