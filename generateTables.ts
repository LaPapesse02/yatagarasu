import { SQL } from "bun";
import { database } from './secrets.yml'


const sql = new SQL({
    adapter: 'mariadb',

    database: database.name,
    hostname: database.url,
    port:     database.port,

    username: database.user,
    password: database.password
});

console.log('Creating table \'series\'.');
await sql`
    CREATE TABLE IF NOT EXISTS series (
        id CHAR(30) NOT NULL PRIMARY KEY,
        title TEXT(300) NOT NULL,
        description TEXT(4000),
        year CHAR(4) NOT NULL,
        completed BOOL NOT NULL,
        url TEXT(400) NOT NULL,
        image_url TEXT(400) NOT NULL,
        latest_chapter INT(4) UNSIGNED NOT NULL,
        last_modified DATETIME NOT NULL
    );
`;
console.log('Done!')

console.log('Creating table \'series_authors\'.');
await sql`
    CREATE TABLE IF NOT EXISTS series_authors (
        series_id CHAR(30) NOT NULL,
        author_id CHAR(30) NOT NULL,
        name CHAR(50) NOT NULL,
        role CHAR(30) NOT NULL
    );

`;
console.log('Done!')

console.log('Creating table \'series_genres\'.');
await sql`
    CREATE TABLE IF NOT EXISTS series_genres (
        series_id CHAR(30) NOT NULL,
        genre CHAR(30) NOT NULL
    );
`;
console.log('Done!')

console.log('Creating table \'subscribed_series\'.');
await sql`
    CREATE TABLE IF NOT EXISTS subscribed_series (
        user_id CHAR(30) NOT NULL,
        series_id CHAR(30) NOT NULL
    );
`;
console.log('Done!')

console.log('Finished generating tables.')