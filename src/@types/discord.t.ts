import { SlashCommandBuilder } from "discord.js";

declare module 'discord.js' {
    export interface Client {
        commands: Command[]
    }
}

export interface Command {
    data: SlashCommandBuilder,
    execute: Function
}

export interface RequestResult {
    id: number,
    title: string,
    year: string
}