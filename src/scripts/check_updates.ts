import { Series } from "../@types/database.t";
import { getCachedLatestChapter, getSubscribedSeries, getUsersSubscribed } from "./database"
import { getSeries } from "./mangaupdates";

/**
 * returns all series that were updated
 */
const getUpdates = async () => {
    const updatedSeries: Series[] = [];
    const subscribedSeries = await getSubscribedSeries();

    for (let series of subscribedSeries) {
        const seriesInfo = (await getSeries(series.series_id))!;
        const cachedChapter = await getCachedLatestChapter(series.series_id);

        if (seriesInfo?.latest_chapter != cachedChapter)
            updatedSeries.push(seriesInfo)
    }

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
