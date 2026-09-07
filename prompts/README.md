# Prompts

Canonical affiliate draft prompts live in `packages/ai/src/prompts/`.

The structured draft schema is `affiliateContentDraftSchema` (`hook`, `script`, `caption`, `hashtags`, `cta`, `videoScenePlan`, `qualityScore`, optional `language` / `tone`).

Content is platform-neutral. Facebook- and TikTok-specific formatting belongs in distribution adapters, not in the core prompt.

`tiktokContentDraftSchema` remains as a deprecated alias.
