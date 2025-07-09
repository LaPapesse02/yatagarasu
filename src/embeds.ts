import { ActionRowBuilder, Colors, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import type { RequestResult } from "./@types/discord.t";


const MAX_TITLE_LENGTH = 50;
const MAX_DESC_LENGTH = 400

const shortenTitle = (title: string) => {
        if (title.length > MAX_TITLE_LENGTH) {
            return `${title.slice(0, MAX_TITLE_LENGTH - 1)}…`;
        } else {
            return title;
        }
}

const shortenDescription = (desc: string) => {
        if (desc.length > MAX_DESC_LENGTH) {
            return `${desc.slice(0, MAX_DESC_LENGTH - 1)}…`;
        } else {
            return desc;
        }
}

export const SEARCHING_EMBED = new EmbedBuilder()
    .setTitle('Searching manga...');

export const generateResultListEmbed = (resultList: RequestResult[]) => {
    let embedContent = '';
    let counter = 1;
    resultList.forEach(result => {
        embedContent = embedContent.concat(`${counter}. **${shortenTitle(result.title)}** (${result.year})\n`);
        counter++;
    })

    return new EmbedBuilder()
        .setDescription(embedContent)
        .setColor(Colors.Green)
}

export const generateResultListComponents = (resultList: RequestResult[]) => {
    const optionsList: StringSelectMenuOptionBuilder[] = [];
    let counter = 1;

    resultList.forEach(result => {
        optionsList.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(shortenTitle(`${counter}. ${shortenTitle(result.title)}`))
                .setValue(result.id.toString())
        )
        counter++
    })

    const select = new StringSelectMenuBuilder()
        .setCustomId('result_selection')
        .setPlaceholder('Choose a result!')
        .addOptions(optionsList);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export const generateSeriesInfoEmbed = (seriesInfo: any) => {
    return new EmbedBuilder()
    .setColor(Colors.Aqua)
        .setTitle(seriesInfo.title)
        .setURL(seriesInfo.url)
        .setFields(
            {
                name: 'Authors',
                value: seriesInfo.authors
                    .filter((author: any) => { return author.type === 'Author'})
                    .map((author: any) => author.name)
                    .join('\n'),
                inline: true
            },
            {
                name: 'Artists',
                value: seriesInfo.authors
                    .filter((author: any) => { return author.type === 'Artist'})
                    .map((author: any) => author.name)
                    .join('\n'),
                inline: true
            },
            {
                name: 'Original Publisher',
                value: seriesInfo.publisher,
                inline: true
            },
            {
                name: 'Description',
                value: shortenDescription(seriesInfo.description)
            },
            {
                name: 'Genres',
                value: seriesInfo.genres.join(', ')
            },
            {
                name: 'Latest Chapter',
                value: seriesInfo.latest_chapter.toString()
            }
        )
        .setImage(seriesInfo.image)
        .setFooter({ text: `Powered by MangaUpdates!     ID:${seriesInfo.id}` })
}