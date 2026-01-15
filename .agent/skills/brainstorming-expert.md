---
name: brainstorming-expert
description: Deep problem solving with mandatory clarification phase, strategic planning, and TDD-first implementation
sasmp_version: "1.3.0"
version: "1.0.0"
bonded_agent: 00-strategic-planner
bond_type: PRIMARY_BOND
allowed-tools: Read, Write, Bash, Glob, Grep

# Parameter Validation
parameters:
  depth:
    type: string
    enum: [guarded, deep, rapid]
    default: deep
    description: Depth of clarification required
---

# Brainstorming Expert Skill

Enforce a rigorous "Clarify -> Plan -> Implement -> TDD" workflow to prevent assumptions and ensure high-quality software design.

## Overview

This skill transforms the agent into a Strategic Facilitator. It strictly inhibits immediate code generation in favor of a structured discovery process. It ensures that no code is written until the problem space is fully mapped and a Test-Driven Development (TDD) strategy is in place.

## When to Use This Skill

Use when you need to:
- Tackle ambiguous or complex user requests
- Design new architectures or large features
- Refactor legacy code with high risk
- Debug complex system interactions where the root cause is unclear
- Ensure 100% test coverage for critical paths

## Workflow Protocol

### Phase 1: Clarification (Mandatory)
**STOP AND ASK.** Do not propose a solution yet.
- Identify missing requirements.
- Challenge assumptions.
- Clarify edge cases (scalability, security, errors).
- **Output**: A numbered list of clarifying questions.

### Phase 2: Strategic Planning & TDD Design
**Only proceed after user answers Phase 1.**
- Create a detailed `implementation_plan.md`.
- **TDD Strategy**: Define exact test cases *before* implementation details.
- **Architecture**: Diagram data flow and component interactions.
- **Verification**: Define "Success Criteria" for the MVP.

### Phase 3: Implementation Steps
**Only proceed after Plan approval.**
- Break down work into atomic steps.
- Write strict TDD tests first (Red phase).
- Implement code to pass tests (Green phase).
- Refactor for cleanliness (Refactor phase).

## Quick Reference

```markdown
<!-- Phase 1 Example Output -->
## 🧠 Clarification Required
I need to clarify a few points before designing the solution:
1. **Scale**: Are we optimizing for 100 or 1M users?
2. **Constraints**: Must we use the existing `ProxyService`, or can we refactor?
3. **Edge Cases**: How should the system handle offline mode during a transaction?
```

```markdown
<!-- Phase 2 Example Output -->
## 📋 TDD & Implementation Plan
### Test Cases (To be written first)
- [ ] `should_retry_3_times_on_403_error`
- [ ] `should_fallback_to_cache_if_network_unreachable`
- [ ] `should_throw_validation_error_on_missing_hash`
```

## Useful Commands

```bash
# Brainstorming helpers
grep -r "TODO" src/              # Find known technical debt
wc -l src/services/*             # Gauge complexity by line count
npm test -- --coverage           # Check current test gaps
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| User is vague | Ask binary questions (A vs B) to force decisions |
| Too many unknowns | Propose a "Spike" (research task) before the main plan |
| Scope creep | Refer back to the agreed "Phase 2" plan and defer extras |

## Usage

```
Skill("brainstorming-expert")
```
