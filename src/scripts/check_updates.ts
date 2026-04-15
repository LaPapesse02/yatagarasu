import { Client } from "discord.js";
import { Series } from "../@types/database.t";
import { cacheSeries, getCachedLatestChapter, getSubscribedSeries, getUsersSubscribed } from "./database"
import { getSeries } from "./mangaupdates";
import { notifyUsers } from "./discord";
import { sleep } from "bun";


export const updateLoop = async (client: Client) => {
    let checked = false;
    
    while (true) {
        let currentTime = new Date();
        if (currentTime.getHours() >= 19 && !checked) {
            getUpdates(client);
            checked = true;
        } else if (checked && currentTime.getHours() < 19) {
            checked = false;
        }
        await sleep(60_000)
    }
}

/**
 * returns all series that were updated
 */
const getUpdates = async (client: Client) => {
    const updatedSeries: Series[] = [];
    const subscribedSeries = await getSubscribedSeries();

    for (let series of subscribedSeries) {
        const seriesInfo = (await getSeries(series.series_id))!;
        const cachedChapter = await getCachedLatestChapter(series.series_id);

        if (seriesInfo?.latest_chapter != cachedChapter)
            updatedSeries.push(seriesInfo)
            await cacheSeries(seriesInfo)
    }

    const notificationList = await createNotificationLists(updatedSeries);
    notifyUsers(client, notificationList);

}

/**
 * get all users that need to be notified about an update
 */
const createNotificationLists = async (updatedSeries: Series[]) => {
    const notifications = new Map<string, Series[]>();
    
    for (let series of updatedSeries) {
        const usersSubsribed = await getUsersSubscribed(series.id);

        for (let user of usersSubsribed) {
            if (notifications.has(user.user_id)) {
                notifications.get(user.user_id)?.push(series);
            } else {
                notifications.set(user.user_id, [ series ])
            }
        }
    }

    return notifications;
}
