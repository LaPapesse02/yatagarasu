import { Author, Genre, Series } from "../@types/database.t";

const SERIES_SEARCH_URL     = 'https://api.mangaupdates.com/v1/series/search'
const SERIES_PARTIAL_URL    = 'https://api.mangaupdates.com/v1/series'        // https://api.mangaupdates.com/v1/series/{id}

const NSFW_FILTERS = ['Adult', 'Hentai', 'Smut'] 

export const search = async (series: string, maxSearchResults: number, exclude_nsfw: boolean) => {
    const filters: string[] = [];

    if (exclude_nsfw)
        filters.push(...NSFW_FILTERS);

    const req = await fetch(
        SERIES_SEARCH_URL,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                search: series,
                exclude_genre: filters
            })
        }
    );

    if (req.status != 200) {
        return null;
    }

    return (await req.json()).results.slice(0, maxSearchResults);
}

export const getSeries = async (seriesId: string | number) => {
    const req = await fetch(`${SERIES_PARTIAL_URL}/${seriesId}`);

    if (req.status != 200) {
        return null;
    }

    const responseContent: any = await req.json();

    const series: Series = {
        id: responseContent.series_id,
        title: responseContent.title,
        description: responseContent.description,
        year: responseContent.year,
        completed: responseContent.completed,
        url: responseContent.url,
        image_url: responseContent.image.url.original ? responseContent.image.url.original : 'attachment://no_image.jpg',
        latest_chapter: responseContent.latest_chapter,
        genres: responseContent.genres.map(
            (genre: any): Genre => ({
                series_id: seriesId.toString(),
                genre: genre.genre
            })
        ),
        authors: responseContent.authors.map(
            (author: any): Author => ({
                series_id: seriesId.toString(),
                author_id: author.author_id,
                name: author.name,
                role: author.type
            })
        ),
        last_modified: new Date()
    };

    return series;
}
