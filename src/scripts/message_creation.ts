import { ContainerBuilder, TextDisplayBuilder } from "discord.js"


export const LOADING_MESSAGE = (() => {
    let container = new ContainerBuilder();
    let text = new TextDisplayBuilder().setContent('### Loading…');

    container.addTextDisplayComponents(text);

    return container;
})()
export const ERROR_MESSAGE = (() => {
    let container = new ContainerBuilder();
    let text = new TextDisplayBuilder().setContent('### An error occurred while searching!');

    container.setAccentColor(0xC80000); // sets the accent color to red
    container.addTextDisplayComponents(text);

    return container;
})()
export const NO_RESULTS_MESSAGE = (() => {
    let container = new ContainerBuilder();
    let text = new TextDisplayBuilder().setContent('### No results were found!');

    container.setAccentColor(0xC80000); // sets the accent color to red
    container.addTextDisplayComponents(text);

    return container;
})()