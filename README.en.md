# Stash · 随手抽屉

[中文](README.md) | **English**

> A DSH plugin that stashes "look-up / ask later" snippets while you work, then lets you pick one to ask on the spot — all **low-interruption, without breaking flow**.

Working package name `dsh-stash`.

---

## Design Principle (the core)

**Low interruption. Never break your flow.**

- **Stash instantly**: select → save, no dialogs, no new tabs.
- **Ask in place**: follow up inside a small window on the current page.
- Stay focused now; your stash holds your thoughts until you're ready.

The name "Stash" captures the idea — like `git stash`: set something aside without breaking your flow, then come back to it later. Both actions — stashing and asking — are covered.

---

## Two Core Use Cases

### Use Case 1 · Quick Capture (stay focused)

> On the current chat page, select a piece of text or a phrase and add it to a place (**your stash**; originally "Inspiration Library" — name TBD) for storage, so you stay focused on the current conversation; you can do the extra conversation or Q&A later.

- **Trigger**: while reading info, opening files, or reading replies, you hit an **unfamiliar keyword** or an **inspiring passage** worth revisiting.
- **Action**: select the text → tuck it into your stash.
- **Effect**: low interruption, flow preserved — stay focused now, process later.

### Use Case 2 · Pick & Ask (follow up later)

> On the current chat page, select a piece of text or a phrase, or pick from your stash — one item or several — and overlay a temporary follow-up question in a small window on the current page. When asking, choose whether to include the current context.

- **Sources (single or multiple)**:
  1. a selected passage/phrase in the chat;
  2. one item from your stash;
  3. one or more items from your stash.
- **Presentation**: ask inside a small window overlaid on the current page — no new tab, no broken flow.
- **Key option**: choose whether to **include context** — with context the question carries the current conversation; without it, it is answered independently around the selected content.

---

## What This Is

- **In one line**: stash "not now / search later" thoughts to stay focused, then pick one to ask in an in-page floating window whenever you're ready.
- **Problem solved**: while using AI you often hit a keyword or passage that sparks a new idea, or something you don't understand and would normally search — but you don't want to get distracted now, nor open a new page.
- **Form**: DSH plugin (hybrid — host remote + storage + LLM; client floating UI + text-selection capture).

---

## Repository Map (SDD layout)

| Path | Purpose |
|---|---|
| `docs/vision/` | Vision & original ideas (uncompressed) |
| `docs/requirements/` | Requirements (FR / NFR / acceptance) |
| `docs/spec/` | Technical spec (SDD core — spec as contract) |
| `docs/plan/` | Roadmap / backlog / ADRs |
| `docs/issues/` | Open questions / risks |
| `src/host/` | Host code (remote + storage + LLM) |
| `src/client/` | Client code (shell.overlay + selection capture) |
| `tests/` | Tests |
| `scripts/` | Build scripts |

---

## Status

- [ ] Stage: **Spec** (project started; no code yet)
- [ ] Next: resolve open questions; scaffold into MVP.

---

## SDD Workflow

1. **Vision** (`docs/vision/`) → 2. **Requirements** (`docs/requirements/`) → 3. **Spec** (`docs/spec/`, contract before code) → 4. **Plan** (`docs/plan/`) → 5. **Implementation** (`src/`) → 6. **Verification** (`tests/`).

> Principle: **spec is contract** — any implementation goes back to `docs/spec/` to update the contract first; idea changes flow down from `docs/vision/`, never straight into code.
