# Bluenova Creator Hub: documentation

New to the project? Read these in order.

| # | Document | Read it to learn… |
|---|---|---|
| 1 | [ARCHITECTURE.md](ARCHITECTURE.md) | The big picture: the apps, where they run, the folder map, and how a request travels |
| 2 | [FLOWS.md](FLOWS.md) | **Every journey step by step:** which page calls which API, and where you go on success or failure (with diagrams) |
| 3 | [API.md](API.md) | Every endpoint: who may call it, what it takes and returns, which page uses it |
| 4 | [DATA_MODELS.md](DATA_MODELS.md) | What is stored in MongoDB, how the collections connect, and the status diagrams |
| 5 | [SECURITY.md](SECURITY.md) | How accounts and data are protected, and the go-live checklist |
| 6 | [DESIGN.md](DESIGN.md) | Colours, fonts, UI components, pop-ups, UX rules, languages |
| 7 | [CODING_STANDARDS.md](CODING_STANDARDS.md) | How code is written here, plus step-by-step "how to add an endpoint / page / field" |
| 8 | [TESTING.md](TESTING.md) | Automated tests and a manual checklist |
| 9 | [DEPLOYMENT.md](DEPLOYMENT.md) | Settings (.env), Render, Vercel, Atlas, email, Google, admin accounts, troubleshooting |
| – | [DECISIONS.md](DECISIONS.md) | Why things are the way they are (history of decisions) |
| – | [BLUENOVA_AI_BUILD_PROMPT.md](BLUENOVA_AI_BUILD_PROMPT.md) | The original full product specification |
| – | [../AGENTS.md](../AGENTS.md) | Short "memory" for AI coding tools (rules + where things are) |

## Glossary
| Word | Meaning here |
|---|---|
| **Creator** | An Instagram content maker (influencer) using the website |
| **Brand** | A business that wants creators to promote it |
| **Team / admin** | Bluenova staff using the admin panel. Team roles: super_admin, reviewer, campaign_manager, finance |
| **Role** | creator, brand or admin. Website users choose creator or brand once, after their first login |
| **Onboarding** | The steps a new creator (profile) or brand (company details) fills in |
| **Campaign** | A brand's request: what content, which creators, when, budget |
| **Shortlist** | Creators the team proposes to a brand for a campaign |
| **Offer** | A proposal sent to a creator after the brand selects them (48 h to answer) |
| **Deal** | Accepted work: from payment or start, to draft, to live post, to completed |
| **Paise** | 1/100 of a rupee. All money is stored in paise |
| **OTP / code** | The 6-digit email code that proves an email address is real |
| **TOTP / authenticator** | The changing 6-digit code from Google Authenticator, used for team login |
| **Access token / refresh cookie** | The two keys that keep you logged in (see SECURITY.md §2) |
| **Hash** | A one-way fingerprint. Passwords are stored as hashes and can't be read back |
| **Audit log** | A permanent record of important team actions |
| **Serializer / view** | Code that picks which fields a given person may see |
| **State machine** | The list of allowed status changes and who may make them |
| **Dialog / modal** | A pop-up window (e.g. "Set a new password") |
| **Model** | The definition of one MongoDB collection (e.g. `UserModel`) |
