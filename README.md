# VoiceJoinLeave

[![CI](https://github.com/Ariazonaa/voiceJoinLeave/actions/workflows/ci.yml/badge.svg)](https://github.com/Ariazonaa/voiceJoinLeave/actions/workflows/ci.yml)

A [Vencord](https://github.com/Vendicated/Vencord) userplugin that shows at a glance who just joined or left a voice channel.

> This is a third party plugin. It is not made or supported by the Vencord team, so please report problems [here](https://github.com/Ariazonaa/voiceJoinLeave/issues) and not in the Vencord server.

## Features

- Users who join a voice channel are highlighted green in the channel list for a while
- Users who leave stay in the list for the same time, greyed out, at the position they had
- A user who moves is greyed out in the old channel and highlighted in the new one
- The user limit badge (e.g. 03/05) only counts users who are really connected
- The avatars in the call panel (above your account panel) work the same way: users who join get a green ring, users who leave stay there greyed out

## Installation

Userplugins only work with a Vencord build from source. If you haven't done that yet, follow the official guide first: [Installing Vencord from source](https://docs.vencord.dev/installing/) and [Custom plugins](https://docs.vencord.dev/installing/custom-plugins/).

Then, inside your Vencord folder:

```sh
cd src/userplugins
git clone https://github.com/Ariazonaa/voiceJoinLeave
cd ../..
pnpm build
pnpm inject   # only needed the first time
```

Restart Discord completely and enable **VoiceJoinLeave** in Settings → Vencord → Plugins.

### Updating

```sh
cd src/userplugins/voiceJoinLeave
git pull
cd ../../..
pnpm build
```

Then restart Discord.

## Settings

| Setting | What it does |
|---|---|
| Duration | How many seconds the highlight and the greyed out entry last (default 30) |
| Show joined | Highlight users who just joined |
| Show left | Keep users who just left in the list, greyed out |

The highlight colour can be changed with the CSS variable `--vc-vjl-join-color`, e.g. in your QuickCSS:

```css
:root {
    --vc-vjl-join-color: #5865f2;
}
```

## Limitations

- Only changes that happen while Discord is running and that your client is told about live are shown. Users who were already in a channel when you started Discord or opened a large server are not highlighted
- You joining a channel is highlighted, but you leaving or moving is not shown: Discord updates your own state before the server confirms it
- Stage channels and calls outside of servers are left alone
- A greyed out user is no longer connected, so actions on them (move, disconnect, mute) do nothing
- Discord updates can break the patches. If the plugin stops working after an update, check for a new version or open an issue

## Development

The logic that doesn't depend on Discord is unit tested. Run from your Vencord folder:

```sh
node --import tsx --test src/userplugins/voiceJoinLeave/tracker.test.ts
```

CI builds the plugin against the latest Vencord on every push and once a day. It also loads Discord stable and canary with Vencord's patch reporter and fails if one of this plugin's patches no longer applies, so a Discord update that breaks the plugin shows up as a red badge above.

## Credits

Written with the help of AI (Claude by Anthropic).

## License

[GPL-3.0-or-later](./LICENSE), like Vencord itself.
