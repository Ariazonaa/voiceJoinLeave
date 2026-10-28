/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Pure logic only. Must not import anything Discord- or Vencord-specific so it stays testable outside Discord.

export interface VoiceEvent {
    userId: string;
    guildId?: string | null;
    channelId?: string | null;
    /** only set by Discord for live gateway updates, missing on states from the initial sync */
    oldChannelId?: string | null;
}

export interface Transition {
    joined?: string;
    left?: string;
}

export type RowState = "joined" | "left" | null;

/** A user who left a channel and is still shown in it. `entry` is whatever the voice user list renders */
export interface Ghost<E> {
    userId: string;
    channelId: string;
    guildId: string;
    entry: E;
    /** timestamp at which the ghost disappears */
    until: number;
}

/** @returns which channel a live voice state update joined and/or left, or null if it did neither */
export function classify(state: VoiceEvent): Transition | null {
    if (state.guildId == null || !("oldChannelId" in state)) return null;

    const joined = state.channelId ?? undefined;
    const left = state.oldChannelId ?? undefined;
    if (joined === left) return null;

    const transition: Transition = {};
    if (joined) transition.joined = joined;
    if (left) transition.left = left;
    return transition;
}

const key = (channelId: string, userId: string) => `${channelId}:${userId}`;

export class Tracker<E> {
    /** highlight end timestamps by channel and user */
    private joined = new Map<string, number>();
    private left = new Map<string, Ghost<E>>();

    join(channelId: string, userId: string, until: number) {
        const k = key(channelId, userId);
        this.left.delete(k);
        this.joined.set(k, until);
    }

    leave(ghost: Ghost<E>) {
        const k = key(ghost.channelId, ghost.userId);
        this.joined.delete(k);
        this.left.set(k, ghost);
    }

    rowState(channelId: string, userId: string, now: number): RowState {
        const k = key(channelId, userId);

        const ghost = this.left.get(k);
        if (ghost && ghost.until > now) return "left";

        const until = this.joined.get(k);
        return until != null && until > now ? "joined" : null;
    }

    /** @param guildId the server to list ghosts of, or null for all servers */
    ghosts(guildId: string | null, now: number): Ghost<E>[] {
        const result: Ghost<E>[] = [];
        for (const ghost of this.left.values())
            if (ghost.until > now && (guildId == null || ghost.guildId === guildId))
                result.push(ghost);

        return result;
    }

    /** @returns whether anything expired */
    prune(now: number): boolean {
        let changed = false;

        for (const [k, until] of this.joined)
            if (until <= now) changed = this.joined.delete(k);

        for (const [k, ghost] of this.left)
            if (ghost.until <= now) changed = this.left.delete(k);

        return changed;
    }

    nextExpiry(): number | undefined {
        let next: number | undefined;
        for (const until of this.joined.values())
            if (next == null || until < next) next = until;
        for (const { until } of this.left.values())
            if (next == null || until < next) next = until;

        return next;
    }

    /** @returns whether there was anything to clear */
    clear(): boolean {
        const had = this.joined.size > 0 || this.left.size > 0;
        this.joined.clear();
        this.left.clear();
        return had;
    }
}

interface Sortable {
    user: { id: string; };
    /** Discord sorts the users of a voice channel by this string */
    comparator: string;
}

/**
 * Adds ghosts to the voice users of their channels, at the position they were sorted at before they left.
 *
 * @param voiceStates voice users by channel id, as Discord's channel list gets them. Not modified
 * @returns the same object if there is nothing to add
 */
export function mergeGhosts<E extends Sortable>(voiceStates: Record<string, E[]>, ghosts: Ghost<E>[]): Record<string, E[]> {
    let merged: Record<string, E[]> | undefined;
    const copied = new Set<string>();

    for (const { channelId, userId, entry } of ghosts) {
        const current = (merged ?? voiceStates)[channelId] ?? [];
        if (current.some(e => e.user.id === userId)) continue;

        merged ??= { ...voiceStates };
        const list = copied.has(channelId) ? current : [...current];
        copied.add(channelId);

        let index = list.findIndex(e => e.comparator > entry.comparator);
        if (index === -1) index = list.length;
        list.splice(index, 0, entry);

        merged[channelId] = list;
    }

    return merged ?? voiceStates;
}
