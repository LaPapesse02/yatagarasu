import { SQL } from "bun";
import { database } from '../../secrets.yml'
import { Author, Genre, Series, SubscribedSeries } from "../@types/database.t";


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

    // returns true if results contains any elements
    return !!results.length;
}

export const addSeriesSubscription = async (userId: string | number, seriesId: string | number) => {
    await sql`
    INSERT INTO subscribed_series
    VALUES (${userId}, ${seriesId})
    `;
}

export const removeSeriesSubscription = async (userId: string | number, seriesId: string | number) => {
    await sql`
    DELETE FROM subscribed_series
    WHERE user_id = ${userId}
    AND series_id = ${seriesId}
    `;
}

export const getUserSubscriptions = async (userId: string | number) => {
    const series: SubscribedSeries[] = await sql`
    SELECT *
    FROM subscribed_series
    WHERE user_id = ${userId}
    `

    return series;
}

export const cacheGenres = async (seriesId: string | number, genres: Genre[]) => {
    await sql`
    DELETE FROM series_genres
    WHERE series_id = ${seriesId}
    AND genre NOT IN (${genres.map((genre) => genre.genre).join(', ')})
    `

    genres.forEach(async (genre) => {
        await sql`
        IF NOT EXISTS (SELECT * FROM series_genres WHERE series_id = ${seriesId} AND genre = ${genre.genre}) 
        THEN
            INSERT INTO series_genres VALUES (${seriesId}, ${genre.genre});
        END IF
        `
    })
}

export const cacheAuthors = async (seriesId: string | number, authors: Author[]) => {
    const authorIds = authors.map((author) => author.author_id).join(', ');
    const authorRoles = authors.map((author) => author.role).join(', ');

    await sql`
    DELETE FROM series_authors
    WHERE series_id = ${seriesId}
    AND author_id NOT IN (${authorIds})
    AND role NOT IN (${authorRoles})
    `

    authors.forEach(async (author) => {
        await sql`
        IF NOT EXISTS (
            SELECT *
            FROM series_authors
            WHERE series_id = ${seriesId}
            AND author_id = ${author.author_id}
            AND role = ${author.role}
        )
        THEN
            INSERT INTO series_authors VALUES (${seriesId}, ${author.author_id}, ${author.name}, ${author.role});
        END IF
        `
    })
}

export const cacheSeries = async (series: Series) => {
    await sql`
    INSERT INTO series VALUES (
        ${series.id},
        ${series.title},
        ${series.description},
        ${series.year},
        ${series.completed},
        ${series.url},
        ${series.image_url},
        ${series.latest_chapter},
        ${series.last_modified}
    )
    ON DUPLICATE KEY
        UPDATE
            title = ${series.title},
            description = ${series.description},
            year = ${series.year},
            completed = ${series.completed},
            url = ${series.url},
            image_url = ${series.image_url},
            latest_chapter = ${series.latest_chapter},
            last_modified = ${series.last_modified}
    `
    
    await cacheAuthors(series.id, series.authors!);
    await cacheGenres(series.id, series.genres!);
}

export const getCachedGenres = async (seriesId: string | number) => {
    const response = sql`
    SELECT *
    FROM series_genres
    WHERE series_id = ${seriesId}
    `

    return response;
}

export const getCachedAuthors = async (seriesId: string | number) => {
    const response = sql`
    SELECT *
    FROM series_authors
    WHERE series_id = ${seriesId}
    `

    return response;
}

export const getCachedSeries = async (seriesId: string | number) => {
    const seriesResponse: Series[] = await sql`
    SELECT *
    FROM series
    WHERE series_id = ${seriesId}
    `
    if (!seriesResponse.length) return null;

    const series = seriesResponse[0];
    series.genres = await getCachedGenres(seriesId);
    series.authors = await getCachedAuthors(seriesId);

    return series;
}
