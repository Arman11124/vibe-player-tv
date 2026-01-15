# VibePlayer MVP & Quality Specification

## 🎯 Target State
- **Functional**: Application must be fully functional (MVP stable) with streaming, search, and navigation.
- **Quality**: Codebase must pass senior-level review for architecture, security, and performance.
- **Resilience**: System must handle network failures and edge cases gracefully.

## 🚀 Mission: Application Resurrection (MVP)

**Goal**: Bring the application to a fully working state (Movies loading, P2P Client active, Server-side Posters/Cards).

## 🤖 Agent Roster & Model Assignments

### 🧠 Command & Control
- **Plan** -> **@Brainstormer** (`skills/brainstorming-expert.md`)
  - **Model**: **GPT (4/o)**
  - *Role*: clarifies requirements updates `implementation_plan.md`, and assigns tasks.
- **Synthesis** -> **@Synthesizer** (`skills/architect-reviewer.md`)
  - **Model**: **Flash (Gemini 1.5)**
  - *Role*: Integrates outputs, maintains `CONTINUITY.md`, and ensures high-speed context compaction.

### 🏗️ Construction (The Builders)
- **Backend** -> **@BackendSquad**
  - **Agents**: `@JavaArchitect`, `@KotlinGuru`, `@EdgeArchitect`
  - **Model**: **Gemini Pro 3 (1.5 Pro)**
  - *Focus*: Server-side logic, Cloudflare Workers, P2P integration reliability.
- **Frontend** -> **@FrontendSquad**
  - **Agents**: `@ReactSpecific`, `@AndroidTV`
  - **Model**: **Opus 4 (Claude 3)**
  - *Focus*: UI/UX, Animations, D-pad Navigation, Component Architecture.

### 🛡️ Quality Assurance (The Guardians)
- **Test** -> **@TestSquad**
  - **Agents**: `@CodeReviewer`, `@ChaosEng`, `@PerfEng`
  - **Model**: **Sonnet (Claude 3.5)**
  - *Focus*: Code quality, Security, Stress testing `spec.md` compliance.

## ⚖️ The Council of Models (Consensus Protocol)

**Objective**: Prevent "Silofed Code" by forcing cross-model validation.
**Voting Logic**:
- Each Squad Casts 1 Vote: **ACCEPT** or **REJECT**.
- **Veto Power**: **@TestSquad (Sonnet)** has Veto power on Security/Stability risks.
- **Pass Criteria**: Unanimous Consent (3/3) OR Majority (2/3) + Sonnet Approval.

## 🗓 Orchestration Workflow

1.  **Planning Phase (GPT)**:
    - User invokes **@Brainstormer** to break down the "Resurrection" into atomic tickets.
2.  **Swarm Execution Phase (Parallel)**:
    - **Backend Squad (Gemini)**: Executes server/proxy tasks.
    - **Frontend Squad (Opus)**: Executes UI/UX tasks.
3.  **Debate Phase (The Council)**:
    - **Cross-Examination**: Opus critiques Backend API; Gemini critiques Frontend Data usage.
    - **Defense**: Agents defend their implementation.
4.  **Voting Phase**:
    - **@TestSquad (Sonnet)** synthesizes the debate and calls for a vote.
5.  **Synthesis**:
    - If **PASSED**: Flash merges to `walkthrough.md`.
    - If **REJECTED**: Return to Execution with specific excessive constraints.
