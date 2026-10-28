/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Vencord's reporter fails as soon as any plugin is broken, so this only looks at the parts of its report about us.
// Usage: node checkReport.cjs <report.md> <plugin name> [webpack find strings...]

const { appendFileSync, readFileSync } = require("node:fs");

const [file, plugin, ...finds] = process.argv.slice(2);
const report = readFileSync(file, "utf8");

if (!report.includes("## Bad Patches")) {
    console.error("The reporter did not finish, there is no report to check");
    process.exit(1);
}

/** report sections by title, each split into its "- " entries */
const sections = Object.fromEntries(
    report.split(/^## /m).slice(1).map(section => {
        const [title, ...body] = section.split("\n");
        return [title.trim(), body.join("\n").split(/^(?=- )/m).filter(e => e.startsWith("- "))];
    })
);

const ownEntry = new RegExp(`^- ${plugin}(?: \\(|\\n|$)`);
const problems = [
    ...(sections["Bad Patches"] ?? []).filter(e => ownEntry.test(e)),
    ...(sections["Bad Starts"] ?? []).filter(e => ownEntry.test(e)),
    ...(sections["Bad Webpack Finds"] ?? []).filter(e => finds.some(f => e.includes(f)))
];

const summary = problems.length
    ? `## ❌ ${plugin}: ${problems.length} problem(s)\n\n${problems.join("\n")}\n`
    : `## ✅ ${plugin}: all patches and finds work\n`;

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");

process.exit(problems.length ? 1 : 0);
