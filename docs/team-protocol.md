# GramSahayak Team & Git Protocol

Single source of truth for interfaces and schemas: **[`/docs/api-contract.md`](api-contract.md)**.
If any local file disagrees with `/docs/api-contract.md`, **the contract wins**.

---

## 1. Repository & Branch Structure

- **`main` (Protected)**: Always deployable / stable milestones. Direct pushes rejected; merge only from `dev` via Lead approval.
  - Tags on `main`:
    - `contract-v1` (Hour 0 — contract freeze)
    - `v0-working-demo` (Hour 16 — end-to-end journey passing)
    - `v1-submission` (Hour 22 — code freeze)
- **`dev` (Integration Branch)**: All feature PRs target `dev`.
- **`feat/<role>-<task>` (or role branches `backend`, `frontend`, `rag`)**: Every teammate works on branches off `dev`, where `<role>` is one of `fe | be | rag | db | lead`:
  - Examples: `feat/db-setup`, `feat/fe-01-shell`, `feat/be-05-eligibility`, `feat/rag-03-query`, `feat/lead-01-cloudtalk`.

### GitHub Branch Protection Commands (Run Once by Repo Admin)

```bash
# Protect main on GitHub using gh CLI:
gh api -X PUT repos/samashech/GramSahayak/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f required_pull_request_reviews='{"required_approving_review_count":1}' \
  -F enforce_admins=false \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

---

## 2. Folder Ownership & Boundaries

Stay strictly inside your assigned folder to guarantee zero merge conflicts:

| Scope Tag | Role | Allowed Folders | Forbidden |
| :---: | :--- | :--- | :--- |
| `fe` | Frontend | `/frontend` | Editing `/backend`, `/rag`, `/db`, `/data/seed` |
| `be` | Backend | `/backend`, `/data/seed/schemes.json` & guides (K-04) | Editing `/frontend`, `/rag`, `/db` |
| `rag` | RAG | `/rag` | Editing `/frontend`, `/backend`, `/db` |
| `db` | Database | `/db`, `/data/seed/demo_personas.json` (+ H0 bootstrap) | Hand-editing facts in `schemes.json`; editing `/frontend`, `/backend`, `/rag` |
| `lead` / `docs` | Team Lead | `/docs`, `/scripts` | Editing service code directly without owner |

If you need an endpoint, column, or field not in `/docs/api-contract.md`:
1. Open a **CONTRACT CHANGE REQUEST** issue (using `.github/ISSUE_TEMPLATE/contract_change_request.md`) and post it in team chat.
2. Carry on immediately using the closest existing field/workaround until approved.
3. Lead approves/rejects within **10 minutes** and records it in `docs/decisions.md`.

---

## 3. Working Cadence & Commit Rules

1. **Small commits every 30–45 minutes** — never hold 3 hours of uncommitted work locally.
2. **Commit format**:
   ```text
   type(scope): concise imperative message
   ```
   - `type`: `feat | fix | docs | chore | test | refactor`
   - `scope`: `fe | be | rag | db | lead | docs`
   - Examples:
     - `feat(db): add postgres and sqlite schemas and sqlite initializer`
     - `feat(rag): implement chroma schema-first ingest`
     - `fix(fe): handle browser speechSynthesis fallback on /voice`
3. **Pull/rebase before pushing**:
   ```bash
   git fetch origin
   git rebase origin/dev
   git push -u origin feat/<role>-<task>
   ```
4. **Pull Requests**:
   - Open a PR into **`dev`** (never straight into `main`).
   - **Lead reviews within 5 minutes** and **squash-merges** into `dev`.
5. **Hard prohibitions**:
   - **NEVER force-push** (`git push --force` is forbidden).
   - **NEVER commit secrets** (`.env`, API keys, Supabase password/service keys), `node_modules`, `.venv`, `chroma_db`, `.next`, or `*.sqlite`.

---

## 4. Merge Conflict & Emergency Recovery Protocol

### Who Resolves Conflicts?
- **Within a single service folder**: The author of the incoming PR resolves it locally by rebasing onto `origin/dev`.
- **Shared files (`/docs/api-contract.md`, `/data/seed/*`, `.env.example`, `README.md`)**: **STOP** — do not guess. Call the **Team Lead** + the file owner together and resolve in 5 minutes against `api-contract.md`.

### Exact Recovery Commands

1. **Inspect current state before touching anything:**
   ```bash
   git status
   ```
2. **Abort a bad merge in progress:**
   ```bash
   git merge --abort
   ```
3. **Abort a bad rebase in progress:**
   ```bash
   git rebase --abort
   ```
4. **Save dirty local work safely before switching branches or pulling:**
   ```bash
   git stash push -u -m "wip before sync"
   # Restore later with:
   git stash list
   git stash pop
   ```
5. **Discard accidental edits to a file outside your folder (restore to HEAD):**
   ```bash
   git restore path/to/other_folder/file
   # If already staged:
   git restore --staged path/to/other_folder/file && git restore path/to/other_folder/file
   ```
6. **Recover a lost commit or undo a bad reset/rebase:**
   ```bash
   git reflog -n 15
   # Create a rescue branch at the good commit SHA before doing anything else:
   git branch rescue-work <good-sha>
   ```
