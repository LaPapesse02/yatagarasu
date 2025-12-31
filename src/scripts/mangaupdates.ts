const SERIES_SEARCH_URL     = 'https://api.mangaupdates.com/v1/series/search'
const SERIES_PARTIAL_URL    = 'https://api.mangaupdates.com/v1/series'        // https://api.mangaupdates.com/v1/series/{id}


export const search = async (series: string, maxSearchResults: number) => {
    const req = await fetch(
        SERIES_SEARCH_URL,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ search: series })
        }
    );

    if (req.status != 200) {
        return null;
    }

    return (await req.json()).results.slice(0, maxSearchResults);
}

export const getSeries = async (seriesId: string) => {
    const req = await fetch(`${SERIES_PARTIAL_URL}/${seriesId}`);

    if (req.status != 200) {
        return null;
    }

    return await req.json()
}
