---
name: Contract Change Request
about: Propose a change or report a discrepancy in /docs/api-contract.md
title: "[CCR] <role>: <endpoint or field>"
labels: contract-change
---

```text
CONTRACT CHANGE REQUEST
FROM: <fe | be | rag | db | lead>
DATE/HOUR: <H..>
CONTRACT VERSION: v1
```

### 1. Who is requesting?
- **Role & Name:**

### 2. Endpoint / Table / Field
- **Location in `/docs/api-contract.md`:**
- **Current Text / Shape:**
  ```json
  ```
- **Requested Text / Shape:**
  ```json
  ```

### 3. Why is this needed?
<!-- What is blocked or wrong? Paste the real payload / error if you have one. -->

### 4. Workaround Until Approved
<!-- Closest existing field or endpoint you are using right now so you stay unblocked. -->

### 5. Impact Matrix
- **Frontend (`/frontend`):** `Yes / No` —
- **Backend (`/backend`):** `Yes / No` —
- **RAG (`/rag`):** `Yes / No` —
- **Database (`/db`):** `Yes / No` —

---

### Lead Decision *(filled by Team Lead within 10 minutes)*
- **Decision:** `approved | rejected | alternative`
- **Owner of the Edit to `/docs/api-contract.md`:** `<role>`
- **New Contract Version:** `v1.<n>`
- **Logged in `/docs/decisions.md`:** `[ ]`
