import { ChatInputCommandInteraction, Client, InteractionCallbackResponse, MessageFlags } from "discord.js";
import { Series, SubscribedSeriesCache } from "../../@types/database.t";
import { getCachedOrRequestSeries, getUserSubscriptions, removeSeriesSubscription } from "../database";
import { createSeriesMessage, createSubscriptionsButtons, createUpdateMessage, LOADING_MESSAGE, NO_IMAGE_ATTACHMENT, NO_SUBSCRIPTIONS_MESSAGE, timeoutInteraction } from "./message_creation";


const INTERACTION_TIMEOUT = 60_000; // 1_000 = 1s

/**
 * the function that runs when /subscriptions gets executed by the user 
 * 
 * @param interaction the interaction of the command
 */
export const subscriptionsCommand = async (interaction: ChatInputCommandInteraction) => {
    // immediately respond to the user so that they know the
    // command is working
    const response = await interaction.reply({
        components: [ LOADING_MESSAGE ],
        flags: MessageFlags.IsComponentsV2,
        withResponse: true
    });

    // get the series that the user is subscribed to
    const subscribedSeries = await getUserSubscriptions(interaction.user.id);

    let subscriptions: SubscribedSeriesCache[] = [];
    // reverse the array so that the series that were subscribed to
    // last are shown first
    for (const series of subscribedSeries.reverse()) {
        subscriptions.push({ series_id: series.series_id });
    }

    await showSubscriptions(interaction, response, subscriptions);
}

/**
 * shows the user's subscriptions
 * 
 * @param interaction - the interaction from when the command was ran
 * @param response - the interaction with the action row in the message
 * @param subscriptions - the series the user is subscribed to
 */
const showSubscriptions = async (interaction: ChatInputCommandInteraction, response: InteractionCallbackResponse<boolean>, subscriptions: SubscribedSeriesCache[]) => {
    const interactionFilter = (i: any) => i.user.id === interaction.user.id;
    let buttonPressed;
    let index = 0;
    let message;
    let buttons;

    while (true) {
        if (subscriptions.length === 0) {
            await interaction.editReply({ components: [ NO_SUBSCRIPTIONS_MESSAGE ] });
            return;
        }

        // cache the series' info so that they dont have to be 
        // retrieved every time the user views a series in their subscriptions
        if (!subscriptions[index].series_info)
            subscriptions[index].series_info = await getCachedOrRequestSeries(subscriptions[index].series_id);

        message = createSeriesMessage(subscriptions[index].series_info!);
        buttons = createSubscriptionsButtons(
            index === 0,
            index === subscriptions.length - 1,
            subscriptions[index].series_info?.url!
        );
        message.addActionRowComponents(buttons);

        interaction.editReply({ components: [ message ] });

        try {
            // wait for the user to press a button
            buttonPressed = await response.resource?.message?.awaitMessageComponent({
                filter: interactionFilter,
                time: INTERACTION_TIMEOUT
            })!;
            
        } catch (error) {
            // remove the buttons if the user doesnt interact for too long
            const timedoutSeriesMessage = timeoutInteraction(message, INTERACTION_TIMEOUT);
            await interaction.editReply({ components: [ timedoutSeriesMessage ] });

            return;
        }

        if (buttonPressed.customId === 'prev')
            index--;
        else if (buttonPressed.customId === 'next')
            index++;
        else if (buttonPressed.customId === 'unsub') {
            await removeSeriesSubscription(interaction.user.id, subscriptions[index].series_id);

            subscriptions.splice(index, 1);
            if (index === subscriptions.length)
                index--
        }

        buttonPressed.deferUpdate();
    }
}

/**
 * sends a message to users who are subscribed to a series that was updated
 * 
 * @param client - the discord client of the bot
 * @param notificationList - a list of users and the series they're subscribed to
 */
export const notifyUsers = async (client: Client, notificationList: Map<string, Series[]>) => {
    for (let [id, seriesList] of notificationList) {
        (async () => {
            const user = await client.users.fetch(id);
            const messages = createUpdateMessage(seriesList);

            // sends messages in groups of 10 series 
            for (let message of messages) 
                await user.send({ components: message, files: [ NO_IMAGE_ATTACHMENT ], flags: MessageFlags.IsComponentsV2 });
        })()
    }
}
