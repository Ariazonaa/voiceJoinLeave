/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { findStoreLazy } from "@webpack";
import { ChannelStore, FluxDispatcher } from "@webpack/common";

import { settings } from "./settings";
import { classify, mergeGhosts, RowState, Tracker, VoiceEvent } from "./tracker";

const logger = new Logger("VoiceJoinLeave");

/** what Discord's voice user list renders per user; we only need the fields used for sorting */
export interface VoiceEntry {
    user: { id: string; };
    comparator: string;
}

export type VoiceStates = Record<string, VoiceEntry[]>;

const SortedVoiceStateStore = findStoreLazy("SortedVoiceStateStore") as {
    getVoiceStatesForChannelAlt(channelId: string, guildId: string): VoiceEntry[];
};

const GUILD_STAGE_VOICE = 13;

const tracker = new Tracker<VoiceEntry>();
const listeners = new Set<() => void>();

let active = false;
let version = 0;
/** the time everything is evaluated at. Only moves when we notify, so React gets stable snapshots */
let clock = 0;
let notifyQueued = false;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

function notify() {
    notifyQueued = false;
    clock = Date.now();
    tracker.prune(clock);
    version++;

    clearTimeout(expiryTimer);
    const next = tracker.nextExpiry();
    if (next != null) expiryTimer = setTimeout(notify, Math.max(0, next - clock));

    for (const listener of listeners) listener();
}

/** Stage channels list speakers separately and size their rows differently, so they are left alone */
const isStage = (channelId: string) => ChannelStore.getChannel(channelId)?.type === GUILD_STAGE_VOICE;

function onVoiceStateUpdates(voiceStates: VoiceEvent[]) {
    const until = Date.now() + settings.store.duration * 1000;
    let changed = false;

    for (const state of voiceStates) {
        const transition = classify(state);
        if (!transition) continue;

        const { left, joined } = transition;
        const guildId = state.guildId!;

        if (left && settings.store.showLeft && !isStage(left)) {
            // we run before the stores handle the update, so the user is still listed in the channel they left
            const entry = SortedVoiceStateStore.getVoiceStatesForChannelAlt(left, guildId).find(e => e.user.id === state.userId);
            if (entry) {
                tracker.leave({ userId: state.userId, channelId: left, guildId, entry, until });
                changed = true;
            }
        }

        if (joined && settings.store.showJoined && !isStage(joined)) {
            tracker.join(joined, state.userId, until);
            changed = true;
        }
    }

    if (changed && !notifyQueued) {
        notifyQueued = true;
        // components may only update once the stores have handled this dispatch
        queueMicrotask(notify);
    }
}

let registered = false;

export function startRuntime() {
    active = true;
    if (registered) return;
    registered = true;

    // interceptors can't be removed again, so this registers once and checks whether we're active on every call
    FluxDispatcher.addInterceptor((action: { type: string; voiceStates?: VoiceEvent[]; }) => {
        if (active && action.type === "VOICE_STATE_UPDATES" && Array.isArray(action.voiceStates)) {
            try {
                onVoiceStateUpdates(action.voiceStates);
            } catch (e) {
                logger.error("Failed to track voice state updates", e);
            }
        }

        return false;
    });
}

export function stopRuntime() {
    active = false;
    reset();
}

/** Forgets all highlights and ghosts */
export function reset() {
    if (tracker.clear()) notify();
}

export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

export const getVersion = () => version;

export function getRowState(channelId: string | undefined, userId: string | undefined): RowState {
    if (!channelId || !userId) return null;

    return tracker.rowState(channelId, userId, clock);
}

/** Number of users in a channel's list who are actually connected, i.e. without the ones who left */
export function countPresent(entries: VoiceEntry[] | undefined, channelId: string | undefined): number {
    if (!entries) return 0;
    if (!channelId) return entries.length;

    return entries.filter(e => tracker.rowState(channelId, e.user.id, clock) !== "left").length;
}

/** @param guildId the server whose channel list is shown, or the id of the favorites list */
export function withGhosts(voiceStates: VoiceStates, guildId: string): VoiceStates {
    try {
        // the favorites list isn't a real server and can contain channels of any server
        const ghosts = tracker.ghosts(/^\d+$/.test(guildId) ? guildId : null, clock);

        return mergeGhosts(voiceStates, ghosts);
    } catch (e) {
        logger.error("Failed to add users who left", e);
        return voiceStates;
    }
}

/** Like {@link withGhosts}, for lists that only show the users of one channel, like the call panel */
export function withChannelGhosts(entries: VoiceEntry[], channelId: string, guildId: string): VoiceEntry[] {
    try {
        const ghosts = tracker.ghosts(guildId, clock).filter(g => g.channelId === channelId);

        return mergeGhosts({ [channelId]: entries }, ghosts)[channelId];
    } catch (e) {
        logger.error("Failed to add users who left", e);
        return entries;
    }
}
