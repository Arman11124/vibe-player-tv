# 🕹️ Mission Control: MVP Resurrection

**Objective**: Complete system restoration (P2P, Posters, UI) using the designated Agent Swarm.

## 📡 Authorization Rules
- **Backend Tasks**: MUST use **Gemini Pro 3** (Persona: `@BackendSquad`).
- **Frontend Tasks**: MUST use **Opus 4** (Persona: `@FrontendSquad`).
- **Planning**: MUST use **GPT** (Persona: `@Brainstormer`).
- **Synthesis**: MUST use **Flash** (Persona: `@Synthesizer`).
- **Testing**: MUST use **Sonnet** (Persona: `@TestSquad`).

---

## 🚀 Execution Runbook (Copy & Paste steps)

### Phase 1: Planning (GPT)

**Step 1.1: Initialize Mission**
> "Activate @Brainstormer. Review `spec.md`. We need to resurrect the `VibePlayer` MVP. Identify the critical path for: 1) Cloudflare Proxy fix, 2) P2P Client 'No Peers' fix, 3) Android TV Poster UI. Output a strict Phase 2 execution plan."

### Phase 2: Execution (Gemini & Opus)

**Step 2.1: Backend - Proxy & P2P (Gemini)**
> "Activate @BackendSquad (Gemini). Reference `skills/edge-proxy-architect.md` and `skills/p2p-streaming-expert.md`. Fix `ProxyService.ts` to handle 403 errors and inject 'Iron Link' trackers into the magnet resolver. Verify with `curl`."

**Step 2.2: Frontend - UI & Posters (Opus)**
> "Activate @FrontendSquad (Opus). Reference `skills/android-tv-master.md`. Fix the `PosterCard` component in `apps/tv` to gracefully handle missing images and ensure 60fps focus animations. Ensure `NextFocus` is set correctly for D-pad."

### Phase 3: The Council Debate (Cross-Examination)

**Step 3.1: Frontend Critiques Backend (Using Opus)**
> "Activate @AndroidTV (Opus). Review the code written by @BackendSquad (Gemini). Does the `ProxyService` response format strictly match the `PosterCard` data requirements? Are there missing fields that will crash the UI? **Critique brutally.**"

**Step 3.2: Backend Critiques Frontend (Using Gemini)**
> "Activate @EdgeArchitect (Gemini). Review the UI code by @FrontendSquad (Opus). Are they requesting images too aggressively (CORS risk)? Are they handling the P2P connection lifecycle correctly? **Critique brutally.**"

### Phase 4: Voting & Final Verdict (Sonnet)

**Step 4.1: The Judge Speaks**
> "Activate @TestSquad (Sonnet). You have heard the critiques.
> 1. Analyze the `ProxyService.ts` (Backend) and `PosterCard.tsx` (Frontend).
> 2. Evaluate the critiques from Step 3.1 and 3.2.
> 3. **CAST YOUR VOTE**:
>    - **ACCEPT**: If code is safe and spec-compliant.
>    - **REJECT**: If critical bugs exist.
>    - **CONDITIONAL**: If minor fixes are needed (list them).
>
> *Warning: You have VETO power if Security is compromised.*"

### Phase 5: Synthesis (Flash)

**Step 5.1: Merge or Retry**
- **If PASSED**:
  > "Activate @Synthesizer (Flash). Update `walkthrough.md`. Mark task as COMPLETE."
- **If REJECTED**:
  > "Activate @Brainstormer (GPT). Create a remediation plan based on Sonnet's rejection."

---

## 🆘 Emergency Overrides

- **If P2P Fails**: "Activate @ChaosEng. Run a simulated tracker outage network test."
- **If UI Lags**: "Activate @PerfEng. Profile the huge list rendering in `Home` screen."
