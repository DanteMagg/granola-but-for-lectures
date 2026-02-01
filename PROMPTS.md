# Prompt Engineering Guide for Lecture Note Companion

Based on [Anthropic's Prompt Engineering Tutorial](https://github.com/anthropics/prompt-eng-interactive-tutorial), here are optimized prompts to systematically improve this project.

## Key Techniques Used

1. **Role Assignment** - Give Claude a specific expert persona
2. **XML Tags** - Separate data from instructions clearly
3. **Precognition** - Ask for step-by-step reasoning
4. **Examples** - Provide few-shot examples where helpful
5. **Structured Output** - Request specific formats
6. **Chain of Thought** - Break complex tasks into steps

---

## 🔍 CODE REVIEW PROMPTS

### Deep Code Review

```
You are a senior software engineer specializing in Electron + React + TypeScript applications. Your task is to perform a comprehensive code review.

<file_to_review>
{paste file contents here}
</file_to_review>

<review_criteria>
1. Code correctness and potential bugs
2. TypeScript type safety (any types, missing types, incorrect types)
3. React best practices (hooks dependencies, memoization, cleanup)
4. Error handling completeness
5. Performance implications
6. Security vulnerabilities
7. Code maintainability and readability
</review_criteria>

For each issue found, provide:
- Severity: [Critical | High | Medium | Low]
- Line number(s) affected
- Problem description
- Suggested fix with code snippet

Think step by step before listing issues. Start by understanding what the code does, then systematically check each criterion.
```

### Architecture Review

```
You are a systems architect reviewing a desktop application built with Electron, React, and local AI models (whisper-node, node-llama-cpp).

<current_architecture>
- Main process: Electron main, handles file I/O, AI bridges
- Renderer process: React app with Zustand state management
- IPC: Communication between main/renderer via preload script
- Data: Local file storage in userData directory
- AI: Local Whisper (STT) and LLaMA (LLM) models
</current_architecture>

<component_list>
{list the components}
</component_list>

Analyze the architecture for:
1. Separation of concerns
2. Data flow clarity
3. Error propagation paths
4. State management patterns
5. Potential bottlenecks
6. Scalability concerns

Provide a diagram (using ASCII or mermaid) showing the ideal data flow, then list specific architectural improvements ranked by impact.
```

---

## 🐛 BUG HUNTING PROMPTS

### Systematic Bug Hunt

```
You are a QA engineer specializing in finding edge cases and bugs in desktop applications.

<code_context>
{paste relevant code}
</code_context>

<user_workflow>
{describe the feature/workflow}
</user_workflow>

Hunt for bugs by thinking through these scenarios:
1. What happens with empty/null/undefined inputs?
2. What happens during rapid user interactions?
3. What happens if async operations fail mid-way?
4. What happens with extremely large inputs?
5. What happens if the user cancels operations?
6. What race conditions are possible?
7. What memory leaks could occur?

For each potential bug:
- Describe the scenario that triggers it
- Explain the expected vs actual behavior
- Provide a minimal reproduction case
- Suggest a fix
```

### Error Handling Audit

```
You are auditing error handling in an Electron application.

<file>
{paste file contents}
</file>

Check every:
1. Promise/async operation - Is rejection handled?
2. API call - Is the response validated?
3. File operation - Is failure handled gracefully?
4. User input - Is it sanitized/validated?
5. try/catch block - Is the error logged and surfaced to UI?

Create a table with columns:
| Location | Operation Type | Current Handling | Risk Level | Recommended Fix |

Be exhaustive. Even seemingly safe operations can fail in edge cases.
```

---

## ⚡ PERFORMANCE OPTIMIZATION PROMPTS

### React Performance Audit

```
You are a React performance specialist. Analyze this component for performance issues.

<component>
{paste component code}
</component>

Check for:
1. Unnecessary re-renders (missing useMemo, useCallback, React.memo)
2. Heavy computations in render path
3. Inefficient list rendering (missing keys, no virtualization)
4. State updates causing cascade re-renders
5. Event handlers recreated every render
6. Effect dependencies causing loops
7. Large objects in dependency arrays

For each issue, provide:
- The problem
- Why it impacts performance  
- The fix with code example
- Estimated impact (High/Medium/Low)

Think through the component lifecycle and render triggers before listing issues.
```

### Memory Leak Detection

```
You are debugging memory leaks in a long-running Electron application.

<code>
{paste relevant code}
</code>

Common leak sources in Electron apps:
1. Event listeners not removed on unmount
2. setInterval/setTimeout not cleared
3. IPC listeners not unregistered
4. Large data retained in closures
5. Audio/Video streams not stopped
6. Canvas contexts not released
7. WebGL contexts not cleaned up

For this code, identify:
- All subscriptions/listeners created
- Whether cleanup is properly implemented
- Any closures holding large references
- Potential accumulation patterns (arrays that grow unbounded)

Provide specific fixes for each leak found.
```

---

## 🎨 UI/UX IMPROVEMENT PROMPTS

### UI Component Critique

```
You are a UI/UX designer reviewing a React component for usability and aesthetics.

<component_code>
{paste code}
</component_code>

<current_behavior>
{describe what it does}
</current_behavior>

Evaluate:
1. Visual hierarchy - Is the most important info prominent?
2. Affordances - Do interactive elements look clickable?
3. Feedback - Does the UI respond to user actions?
4. Error states - Are errors communicated clearly?
5. Loading states - Is progress indicated?
6. Empty states - Is lack of data handled gracefully?
7. Accessibility - Keyboard nav, screen readers, contrast
8. Responsiveness - Does it work at different sizes?

For each issue, provide:
- Screenshot/description of the problem
- Why it hurts UX
- Specific CSS/JSX changes to fix it
- Before/after comparison if helpful
```

### Interaction Design Review

```
You are a UX researcher analyzing a workflow in a lecture note-taking app.

<workflow>
{describe the user journey}
</workflow>

<current_implementation>
{relevant code/UI description}
</current_implementation>

Analyze:
1. Number of clicks/steps to complete task
2. Cognitive load at each step
3. Discoverability of features
4. Reversibility of actions (undo/redo)
5. Progressive disclosure of complexity
6. Consistency with platform conventions
7. Frustration points (waiting, confusion, dead ends)

Provide:
- User journey map (current state)
- Pain points identified
- Proposed improvements with mockups/descriptions
- Prioritized implementation order
```

---

## 🧪 TEST GENERATION PROMPTS

### Comprehensive Test Suite

```
You are a test engineer creating a comprehensive test suite for a React component.

<component>
{paste component code}
</component>

<dependencies>
{list props, hooks, stores used}
</dependencies>

Generate tests covering:
1. Rendering with various prop combinations
2. User interactions (clicks, typing, keyboard)
3. Async operations (loading, success, error states)
4. Edge cases (empty data, null values, boundaries)
5. Accessibility (ARIA, keyboard navigation)
6. Integration with store/context

Use this format:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

describe('ComponentName', () => {
  describe('rendering', () => {
    it('should...', () => {})
  })
  
  describe('user interactions', () => {
    it('should...', () => {})
  })
  
  describe('edge cases', () => {
    it('should...', () => {})
  })
})
```

Include proper mocking setup and cleanup.
```

### Integration Test Scenarios

```
You are designing integration tests for a Lecture Note Companion app.

<feature>
{describe the feature}
</feature>

<components_involved>
{list components}
</components_involved>

Create test scenarios covering the full user journey:

1. Setup: What state/mocks are needed?
2. Actions: What does the user do?
3. Assertions: What should happen?
4. Teardown: What cleanup is needed?

Focus on:
- Happy path (normal usage)
- Error recovery (what if something fails mid-way?)
- Concurrent operations (what if user acts quickly?)
- State persistence (does it survive refresh?)

Provide runnable test code using Vitest + React Testing Library.
```

---

## 📝 DOCUMENTATION PROMPTS

### API Documentation

```
You are a technical writer documenting an internal API.

<code>
{paste module/function code}
</code>

Generate documentation including:

1. **Overview**: One paragraph explaining purpose
2. **Parameters**: Table with name, type, required?, description
3. **Return Value**: Type and description
4. **Errors**: What errors can be thrown and when
5. **Examples**: 2-3 usage examples showing common patterns
6. **Notes**: Edge cases, performance considerations, gotchas

Use JSDoc format that can be extracted by documentation tools.
```

### User Guide Section

```
You are writing user documentation for a lecture note-taking app.

<feature>
{describe the feature}
</feature>

<how_it_works_technically>
{brief technical description}
</how_it_works_technically>

Write a user guide section that:
1. Explains what the feature does (no jargon)
2. Shows how to use it step-by-step
3. Includes tips for best results
4. Addresses common issues/questions
5. Uses screenshots placeholders where helpful: [Screenshot: description]

Target audience: University students who are tech-savvy but not developers.
Tone: Friendly, concise, helpful.
```

---

## 🔐 SECURITY AUDIT PROMPTS

### Security Review

```
You are a security engineer auditing an Electron application that handles user data locally.

<code>
{paste relevant code}
</code>

<context>
- App stores session data (notes, transcripts) locally
- Uses IPC for main/renderer communication
- Downloads AI models from external URLs
- Processes PDF files and audio
</context>

Check for:
1. **Path Traversal**: Can malicious input access files outside allowed directories?
2. **IPC Security**: Are IPC channels properly validated? Could renderer inject commands?
3. **Content Security**: Is remote content sanitized? XSS possible?
4. **Download Safety**: Are downloads validated? MITM risks?
5. **Data Exposure**: Is sensitive data logged or accessible?
6. **Input Validation**: Are all inputs sanitized?
7. **Privilege Escalation**: Could renderer gain main process privileges?

For each vulnerability:
- Severity: [Critical | High | Medium | Low]
- Attack vector
- Potential impact
- Recommended fix with code
```

### Input Sanitization Audit

```
You are reviewing input handling in an Electron app.

<code>
{paste code handling user input}
</code>

For every user input path, verify:
1. What types of input are accepted?
2. Is the input validated/sanitized before use?
3. Is the input used in file paths, shell commands, or HTML?
4. Could special characters cause injection?
5. Are size limits enforced?

Create a table:
| Input Source | Data Type | Validation | Risk | Fix |

Provide sanitization functions for any unprotected inputs.
```

---

## ♿ ACCESSIBILITY AUDIT PROMPTS

### WCAG Compliance Check

```
You are an accessibility specialist auditing a React component against WCAG 2.1 AA standards.

<component>
{paste component code}
</component>

Check:
1. **Perceivable**
   - Alt text for images
   - Color contrast (4.5:1 for text, 3:1 for large text)
   - Text resizing support
   - No info conveyed by color alone

2. **Operable**
   - Keyboard navigation (Tab order, focus visible)
   - No keyboard traps
   - Skip links for repetitive content
   - Sufficient time for interactions

3. **Understandable**
   - Labels for form controls
   - Error identification and suggestions
   - Consistent navigation
   - Predictable behavior

4. **Robust**
   - Valid HTML semantics
   - ARIA used correctly
   - Works with assistive tech

For each issue:
- WCAG criterion violated
- Current implementation
- Required fix with code
- Testing method
```

### Screen Reader Testing Script

```
You are creating a testing script for screen reader compatibility.

<ui_component>
{describe the component}
</ui_component>

<expected_interactions>
{list what users should be able to do}
</expected_interactions>

Create a testing checklist:

1. Navigation flow (what order are elements announced?)
2. Labels (are all interactive elements labeled?)
3. State changes (are updates announced?)
4. Focus management (is focus moved appropriately?)
5. Error announcements (are errors communicated?)

Provide expected screen reader output for key interactions.
Suggest ARIA improvements where current implementation falls short.
```

---

## 🚀 FEATURE IMPLEMENTATION PROMPTS

### Feature Specification

```
You are a product engineer translating a feature request into technical specification.

<feature_request>
{describe what the user wants}
</feature_request>

<existing_codebase>
- React + TypeScript frontend
- Zustand state management  
- Electron main process handles file I/O
- Local AI models for transcription and chat
</existing_codebase>

Produce:

1. **User Stories**
   As a [user], I want [action], so that [benefit]

2. **Technical Requirements**
   - Data models needed
   - API/IPC changes
   - State changes
   - UI components affected

3. **Implementation Plan**
   Step-by-step breakdown with estimated complexity

4. **Edge Cases**
   What could go wrong? How to handle?

5. **Testing Strategy**
   How to verify it works?

6. **Rollout Plan**
   How to ship safely?
```

### Refactoring Plan

```
You are planning a refactoring of a component that has grown unwieldy.

<current_code>
{paste code}
</current_code>

<problems_identified>
{list issues - too long, hard to test, etc.}
</problems_identified>

Create a refactoring plan:

1. **Goal**: What state should the code be in after?

2. **Constraints**: What must not break?

3. **Steps** (each must leave code working):
   - Step 1: [description] - [risk level]
   - Step 2: [description] - [risk level]
   - ...

4. **Extracted Components/Hooks**:
   - Name: Purpose
   - Props/Returns
   - File location

5. **Test Changes Needed**:
   - Tests to update
   - Tests to add

6. **Verification**:
   - How to confirm refactoring didn't break anything
```

---

## 🔗 PROMPT CHAINING (Multi-Step Improvements)

### Full Component Overhaul (Chain of 4 Prompts)

**Step 1: Analysis**
```
Analyze this component and identify all issues:

<component>
{paste code}
</component>

List issues in categories:
- Bugs
- Performance
- Accessibility
- Code quality
- Missing features

Do not suggest fixes yet. Just identify problems comprehensively.
```

**Step 2: Prioritization**
```
Given these issues identified in a component:

<issues>
{paste output from Step 1}
</issues>

Prioritize them:
1. By impact on users (High/Medium/Low)
2. By effort to fix (High/Medium/Low)
3. By risk of regression (High/Medium/Low)

Create a 2x2 matrix: High Impact + Low Effort = Do First
Recommend an order of implementation.
```

**Step 3: Implementation**
```
Implement fixes for these prioritized issues:

<original_code>
{paste code}
</original_code>

<issues_to_fix>
{paste prioritized list from Step 2 - top items only}
</issues_to_fix>

Provide the complete refactored code.
Mark each change with a comment: // FIX: [issue number]
```

**Step 4: Testing**
```
Generate tests for the refactored component:

<original_tests>
{paste existing tests if any}
</original_tests>

<refactored_code>
{paste output from Step 3}
</refactored_code>

<fixes_implemented>
{list the fixes from Step 3}
</fixes_implemented>

Create new tests that:
1. Verify each fix works
2. Prevent regression of the original bugs
3. Cover any new functionality added
```

---

## 📊 Project-Wide Analysis Prompts

### Technical Debt Inventory

```
You are cataloging technical debt across a codebase.

<file_list>
{list all source files}
</file_list>

For each area, identify:
1. **Code Smells**: Long functions, deep nesting, duplication
2. **Architecture Debt**: Wrong abstractions, tight coupling
3. **Dependency Debt**: Outdated packages, security issues
4. **Test Debt**: Missing tests, flaky tests
5. **Documentation Debt**: Missing docs, outdated docs

Create a debt register:
| Item | Location | Type | Severity | Effort | Recommendation |

Prioritize by: risk if not fixed vs effort to fix.
```

### Codebase Health Report

```
You are generating a health report for a React + Electron codebase.

Evaluate these dimensions (1-10 scale with justification):

1. **Code Quality**
   - Consistency of style
   - TypeScript strictness
   - Error handling coverage

2. **Test Coverage**
   - Unit test coverage
   - Integration test coverage
   - Edge case coverage

3. **Performance**
   - Render efficiency
   - Memory management
   - Async handling

4. **Security**
   - Input validation
   - IPC security
   - Data protection

5. **Maintainability**
   - Documentation
   - Code organization
   - Dependency health

6. **Accessibility**
   - WCAG compliance
   - Keyboard navigation
   - Screen reader support

For each dimension, provide:
- Current score (1-10)
- Top 3 issues
- Quick wins (low effort, high impact)
- Long-term improvements needed
```

---

## Usage Instructions

1. **Copy the relevant prompt** for your task
2. **Replace placeholders** like `{paste code}` with actual content
3. **Iterate**: Use the output as input for follow-up prompts
4. **Chain prompts**: For complex tasks, use the multi-step chains

## Tips from the Tutorial

- **Be specific**: Vague prompts get vague answers
- **Use XML tags**: Clearly separate code from instructions
- **Request reasoning**: "Think step by step" improves accuracy
- **Provide examples**: Show what good output looks like
- **Constrain output**: Ask for specific format (tables, code, lists)
- **Assign expertise**: "You are a senior engineer" focuses responses

---

*Generated based on [Anthropic's Prompt Engineering Tutorial](https://github.com/anthropics/prompt-eng-interactive-tutorial)*

