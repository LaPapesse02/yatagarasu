export interface SubscribedSeries {
    user_id: string,
    series_id: string
}

export interface SubscribedSeriesCache {
    series_id: string,
    series_info?: Series
}

export interface Author {
    series_id: string,
    author_id: string,
    name: string,
    role: string
}

export interface Genre {
    series_id: string,
    genre: string
}

export interface Series {
    id: string,

    title: string,
    description: string | null,
    year: string,
    completed: boolean,
    genres?: Genre[],
    authors?: Author[],

    url: string,
    image_url: string,

    latest_chapter: number,

    last_modified: Date
}