import { SQL } from "bun";
import { database } from '../../secrets.yml'
import { SubscribedSeries } from "../@types/database.t";


const sql = new SQL({
    adapter: 'mariadb',

    database: database.name,
    hostname: database.url,
    port:     database.port,

    username: database.user,
    password: database.password
});


export const checkIfUserSubscribed = async (userId: string | number, seriesId: string | number) => {
    const results: SubscribedSeries[] = await sql`
    SELECT *
    FROM subscribed_series
    WHERE user_id = ${userId}
    AND series_id = ${seriesId}
    `;

    return results;
}
