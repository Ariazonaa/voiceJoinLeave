/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    duration: {
        type: OptionType.SLIDER,
        description: "How many seconds users stay highlighted after joining and greyed out after leaving",
        markers: [5, 10, 20, 30, 45, 60, 90, 120],
        default: 30,
        stickToMarkers: false
    },
    showJoined: {
        type: OptionType.BOOLEAN,
        description: "Highlight users who just joined a voice channel",
        default: true
    },
    showLeft: {
        type: OptionType.BOOLEAN,
        description: "Keep users who just left a voice channel in the list, greyed out",
        default: true
    }
});
