# CLAUDE.md

Project instructions for Claude Code. The shared rules for every AI tool live in AGENTS.md:

@AGENTS.md

## Claude-specific notes
- The owner is a beginner. After a change, explain in plain words:
  - what changed;
  - in which file (use clickable `path:line` links);
  - how to try it.
- Ask before:
  - destructive database actions (wiping collections, resetting admins);
  - anything outward-facing (pushing to GitHub, changing Render or Vercel settings, sending real emails).
- Never read secrets out loud from `apps/api/.env` or `ADMIN_SECRET.txt`. Use them only inside scripts.
