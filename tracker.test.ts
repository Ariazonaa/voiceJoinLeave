/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { classify, mergeGhosts, Tracker } from "./tracker";

interface Entry { user: { id: string; }; comparator: string; }

const entry = (id: string, comparator = id): Entry => ({ user: { id }, comparator });
const ghost = (userId: string, channelId: string, until: number, guildId = "g1") =>
    ({ userId, channelId, guildId, entry: entry(userId), until });
const ids = (list: Entry[] | undefined) => list?.map(e => e.user.id);

test("classify: joining a channel from nowhere", () => {
    assert.deepEqual(classify({ userId: "u", guildId: "g", channelId: "c1", oldChannelId: undefined }), { joined: "c1" });
});

test("classify: leaving voice", () => {
    assert.deepEqual(classify({ userId: "u", guildId: "g", channelId: null, oldChannelId: "c1" }), { left: "c1" });
});

test("classify: moving between channels is a leave and a join", () => {
    assert.deepEqual(classify({ userId: "u", guildId: "g", channelId: "c2", oldChannelId: "c1" }), { joined: "c2", left: "c1" });
});

test("classify: mute and other updates inside a channel are no transition", () => {
    assert.equal(classify({ userId: "u", guildId: "g", channelId: "c1", oldChannelId: "c1" }), null);
});

test("classify: states without oldChannelId come from the initial sync, not from a live change", () => {
    assert.equal(classify({ userId: "u", guildId: "g", channelId: "c1" }), null);
});

test("classify: calls outside of servers are ignored", () => {
    assert.equal(classify({ userId: "u", guildId: null, channelId: "c1", oldChannelId: undefined }), null);
});

test("a joined user is highlighted until the time is up", () => {
    const t = new Tracker<Entry>();
    t.join("c1", "u", 30_000);
    assert.equal(t.rowState("c1", "u", 29_999), "joined");
    assert.equal(t.rowState("c1", "u", 30_000), null);
    assert.equal(t.rowState("c2", "u", 0), null);
});

test("a user who left stays as a ghost until the time is up", () => {
    const t = new Tracker<Entry>();
    t.leave(ghost("u", "c1", 30_000));
    assert.equal(t.rowState("c1", "u", 10), "left");
    assert.deepEqual(t.ghosts("g1", 10).map(g => g.userId), ["u"]);
    assert.deepEqual(t.ghosts("g1", 30_000), []);
    assert.equal(t.rowState("c1", "u", 30_000), null);
});

test("ghosts are listed per server, or for all servers", () => {
    const t = new Tracker<Entry>();
    t.leave(ghost("a", "c1", 100, "g1"));
    t.leave(ghost("b", "c9", 100, "g2"));
    assert.deepEqual(t.ghosts("g2", 0).map(g => g.userId), ["b"]);
    assert.deepEqual(t.ghosts(null, 0).map(g => g.userId), ["a", "b"]);
});

test("rejoining the channel removes the ghost", () => {
    const t = new Tracker<Entry>();
    t.leave(ghost("u", "c1", 30_000));
    t.join("c1", "u", 40_000);
    assert.deepEqual(t.ghosts("g1", 10), []);
    assert.equal(t.rowState("c1", "u", 10), "joined");
});

test("leaving right after joining replaces the highlight with a ghost", () => {
    const t = new Tracker<Entry>();
    t.join("c1", "u", 30_000);
    t.leave(ghost("u", "c1", 35_000));
    assert.equal(t.rowState("c1", "u", 10), "left");
    assert.equal(t.rowState("c1", "u", 34_000), "left");
});

test("moving leaves a ghost in the old channel and a highlight in the new one", () => {
    const t = new Tracker<Entry>();
    t.leave(ghost("u", "c1", 30_000));
    t.join("c2", "u", 30_000);
    assert.equal(t.rowState("c1", "u", 10), "left");
    assert.equal(t.rowState("c2", "u", 10), "joined");
});

test("prune drops expired marks and reports whether anything changed", () => {
    const t = new Tracker<Entry>();
    t.join("c1", "a", 100);
    t.leave(ghost("b", "c1", 200));
    assert.equal(t.nextExpiry(), 100);
    assert.equal(t.prune(50), false);
    assert.equal(t.prune(100), true);
    assert.equal(t.nextExpiry(), 200);
    assert.equal(t.prune(200), true);
    assert.equal(t.nextExpiry(), undefined);
});

test("clear reports whether there was anything to clear", () => {
    const t = new Tracker<Entry>();
    assert.equal(t.clear(), false);
    t.join("c1", "a", 100);
    assert.equal(t.clear(), true);
    assert.equal(t.rowState("c1", "a", 0), null);
});

test("mergeGhosts returns the same object when there are no ghosts", () => {
    const states = { c1: [entry("a")] };
    assert.equal(mergeGhosts(states, []), states);
});

test("mergeGhosts inserts ghosts at their sorted position without touching the input", () => {
    const states = { c1: [entry("a"), entry("c")] };
    const merged = mergeGhosts(states, [ghost("b", "c1", 100)]);
    assert.deepEqual(ids(merged.c1), ["a", "b", "c"]);
    assert.deepEqual(ids(states.c1), ["a", "c"]);
});

test("mergeGhosts keeps a channel visible whose last user just left", () => {
    const merged = mergeGhosts<Entry>({}, [ghost("b", "c1", 100), ghost("a", "c1", 100)]);
    assert.deepEqual(ids(merged.c1), ["a", "b"]);
});

test("mergeGhosts skips users who are in the channel again", () => {
    const states = { c1: [entry("a")] };
    assert.equal(mergeGhosts(states, [ghost("a", "c1", 100)]), states);
});

test("mergeGhosts leaves other channels untouched", () => {
    const states = { c1: [entry("a")], c2: [entry("x")] };
    const merged = mergeGhosts(states, [ghost("b", "c1", 100)]);
    assert.equal(merged.c2, states.c2);
});
