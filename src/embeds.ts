import { Colors, EmbedBuilder } from "discord.js";
import type { RequestResult } from "./@types/discord.t";


const MAX_TITLE_LENGTH = 50;

export const SEARCHING_EMBED = new EmbedBuilder()
    .setTitle('Searching manga...');

export const generateResultListEmbed = (resultList: RequestResult[]) => {
    let embedContent = '';
    let counter = 1;
    resultList.forEach(result => {
        embedContent = embedContent.concat(`${counter}. `);

        if (result.title.length > MAX_TITLE_LENGTH) {
            embedContent = embedContent.concat(`**${result.title.slice(0, MAX_TITLE_LENGTH - 1)}…**`);
        } else {
            embedContent = embedContent.concat(`**${result.title}**`);
        }

        embedContent = embedContent.concat(` (${result.year})\n`);
        counter++;
    })

    return new EmbedBuilder()
        .setDescription(embedContent)
        .setColor(Colors.Green)
}