/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Link } from "@components/Link";
import definePlugin from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { Forms, React } from "@webpack/common";

import { countPresent, getRowState, getVersion, reset, startRuntime, stopRuntime, subscribe, VoiceEntry, VoiceStates, withChannelGhosts, withGhosts } from "./runtime";
import { settings } from "./settings";

const REPO_URL = "https://github.com/Ariazonaa/voiceJoinLeave";

export default definePlugin({
    name: "VoiceJoinLeave",
    description: "Highlights users who just joined a voice channel and keeps users who just left in the list for a while, greyed out",
    tags: ["Voice", "Appearance"],
    authors: [{ name: "Ariazonaa", id: 771860763747942483n }],
    settings,

    // userplugins get no source code button in the plugin modal, so link the repo here
    settingsAboutComponent: () => (
        <>
            <Forms.FormTitle tag="h3">Source code &amp; updates</Forms.FormTitle>
            <Forms.FormText>
                This is a third party plugin, not made by the Vencord team. Updates, source code and bug reports: <Link href={REPO_URL}>{REPO_URL.replace("https://", "")}</Link>
                {" · "}
                <Link href={`${REPO_URL}/issues`}>Report a bug</Link>
            </Forms.FormText>
        </>
    ),

    patches: [
        // Guild sidebar: the one place the channel list gets its voice users from, for both rendering and row heights
        {
            find: '"favorite-guild-header-context"',
            replacement: {
                match: /\(0,\i\.\i\)\(\[\i\.\i\],\(\)=>\i\.\i\.getVoiceStates\((\i)\),\[\i\]\)/,
                replace: "$self.useVoiceStates($&,$1)"
            }
        },
        // User limit badge (e.g. 03/05): users who left must not count
        {
            find: 'tutorialId:"voice-conversations"',
            replacement: {
                match: /(\i)\?\.length\?\?0;(?=return null!=\i&&\i&&\i\?\(0,\i\.jsx\)\(\i,\{userCount:)/,
                replace: "$self.countPresent($1,arguments[0]?.channel?.id);"
            }
        },
        // Voice user row in sidebar
        {
            // Same find as RoleColorEverywhere
            find: "#{intl::GUEST_NAME_SUFFIX})]",
            replacement: {
                match: /className:\i\(\)\(\i,(?=\{\[\i\.\i\]:!0,)/,
                replace: "$&$self.useRowClass(arguments[0]),"
            }
        },
        // Call panel (voice connected, above the account panel): the avatars of the users in your channel
        {
            // Same find as CallTimer
            find: '"RTCConnectionMenu"',
            replacement: [
                {
                    match: /(?<=voiceStates:)(\i)(?=,channel:(\i),className:\i\.\i\}\))/,
                    replace: "$self.usePanelVoiceStates($1,$2)"
                },
                {
                    match: /\{channel:(\i),user:(\i),nick:\i,mute:\i,deaf:\i,serverMute:\i,serverDeaf:\i\}=\i,/,
                    replace: "$&vcVjlClass=$self.useAvatarClass($1,$2),"
                },
                {
                    match: /(?<=className:\i\.\i)(?=,style:\{backgroundImage:`url\(\$\{\i\}\)`)/,
                    replace: "+vcVjlClass"
                }
            ]
        }
    ],

    flux: {
        // Discord rebuilds all voice states on reconnect, whatever we remembered no longer matches
        CONNECTION_OPEN: reset
    },

    start: startRuntime,
    stop: stopRuntime,

    useVoiceStates(voiceStates: VoiceStates, guildId: string) {
        const version = React.useSyncExternalStore(subscribe, getVersion);

        return React.useMemo(() => withGhosts(voiceStates, guildId), [voiceStates, guildId, version]);
    },

    countPresent,

    useRowClass(props: { channelId?: string; user?: { id: string; }; }) {
        const state = React.useSyncExternalStore(subscribe, () => getRowState(props?.channelId, props?.user?.id));

        return state && `vc-vjl-${state}`;
    },

    usePanelVoiceStates(entries: VoiceEntry[], channel: Channel | undefined) {
        const version = React.useSyncExternalStore(subscribe, getVersion);

        return React.useMemo(
            () => channel?.guild_id ? withChannelGhosts(entries, channel.id, channel.guild_id) : entries,
            [entries, channel?.id, channel?.guild_id, version]
        );
    },

    useAvatarClass(channel: Channel | undefined, user: { id: string; } | undefined) {
        const state = React.useSyncExternalStore(subscribe, () => getRowState(channel?.id, user?.id));

        return state ? ` vc-vjl-avatar-${state}` : "";
    }
});
