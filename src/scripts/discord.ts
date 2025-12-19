import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { search } from './mangaupdates';


const MAX_SEARCH_RESULTS = 10;
const MAX_TITLE_LENGTH = 50;

const SEARCHING_EMBED = new EmbedBuilder().setTitle('Searching...');
const SEARCH_ERROR_EMBED = new EmbedBuilder().setColor('Red').setTitle('An error occured while searching!');

export const searchCommand = async (interaction: ChatInputCommandInteraction) => {
    await interaction.reply({ embeds: [ SEARCHING_EMBED ] });

    const searchResults = await search(interaction.options.getString('name')!, MAX_SEARCH_RESULTS);
    if (searchResults === null) 
        return interaction.editReply({ embeds: [ SEARCH_ERROR_EMBED ] });

    const resultEmbed = createSearchResultsEmbed(searchResults);
    const selectMenuRow = createSearchResultButtons(searchResults);
    interaction.editReply({ embeds: [ resultEmbed ], components: [ selectMenuRow ] });
}

const createSearchResultsEmbed = (results: [any]) => {
    const embed = new EmbedBuilder().setTitle('Search Results:');
    let descString = '';

    for (let i = 0; i < results.length; i++) {
        descString = descString.concat('\n', `${i+1}. **${shortenString(results[i].record.title, MAX_TITLE_LENGTH)}** (${results[i].record.year})`);
    }
    embed.setDescription(descString);

    return embed
}

const createSearchResultButtons = (results: [any]) => {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('resultSelection')
        .setPlaceholder('Choose Series!')

    for (let i = 0; i < results.length; i++) {
        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(`${i+1}. ${shortenString(results[i].record.title, MAX_TITLE_LENGTH)} (${results[i].record.year})`)
                .setValue(`${results[i].record.series_id}`)
        
        )
    }

    return new ActionRowBuilder().addComponents(selectMenu);
}

const shortenString = (text: string, maxLength: number) => {
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength)}…`
} 