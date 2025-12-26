import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ContainerBuilder, EmbedBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextDisplayBuilder } from "discord.js";
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

    const resultComponent = createSearchResultComponent(searchResults);
    interaction.editReply({ embeds: [ ], components: [ resultComponent ],flags: MessageFlags.IsComponentsV2 })
}

const createSearchResultComponent = (results: [any]) => {
    const container = new ContainerBuilder();
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('resultSelection')
        .setPlaceholder('Choose Series!')
    let resultString = '## Search results:\n';

    for (let i = 0; i < results.length; i++) {
        resultString = resultString.concat('\n', `${i+1}. **${shortenString(results[i].record.title, MAX_TITLE_LENGTH)}** (${results[i].record.year})`)
        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(`${i+1}. ${shortenString(results[i].record.title, MAX_TITLE_LENGTH)} (${results[i].record.year})`)
                .setValue(`${results[i].record.series_id}`)
        )
    }

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(resultString));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));

    return container
}

const shortenString = (text: string, maxLength: number) => {
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength)}…`
} 