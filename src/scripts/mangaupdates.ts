const SERIES_SEARCH_URL = 'https://api.mangaupdates.com/v1/series/search'


const search = async (series: string) => {
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

    return (await req.json()).results;
}
