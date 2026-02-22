import { Series } from "../@types/database.t";
import { getCachedLatestChapter, getSubscribedSeries } from "./database"
import { getSeries } from "./mangaupdates";

/**
 * returns all series that
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
