---
type: Story
title: "Skills Manager: Recommend Skills from Conversation History"
status: draft
---

# Skills Manager: Recommend Skills from Conversation History

As a developer managing many skills, I want the app to recommend skills based
on my past conversations, so that I can quickly find the most relevant skill
without manually browsing long lists.

## Context

The desktop app currently helps users manage skills through Installed,
Available, and Sources tabs. This works well when users already know what they
want, but it is slower when they are exploring what to use next. Many users
repeat similar requests across projects and tools. A recommendations view should
turn that history into practical suggestions, including an "explore new"
perspective for skills the user has not used much yet.

## Acceptance Criteria

### Recommendations View

- The top tab row includes a "Recommendations" tab alongside Installed,
  Available, and Sources.
- The Recommendations view includes controls for "Recommendation Mode"
  (Standard, Explore New), "History Scope" (All Conversations, Current
  Project), and a "Generate" action.

### Recommendation Results

- After recommendations are generated, the list shows suggested skills with a
  visible usage label (unused, low-use, or used) and confidence level.
- Selecting a recommendation shows: Usage, Confidence, Evidence, Match count,
  Why this fit, How to invoke, and an Example from history.
- In "Explore New" mode, skills labeled unused or low-use appear before heavily
  used skills when relevance is similar.
- In "Current Project" scope, recommendations are based only on conversation
  history for the active project.

### Actions and Feedback

- From a recommendation, the user can open the skill for review and install it
  directly if it is not already installed.
- If no matching history is available, the view shows a clear empty state
  message instead of a failure.

## Out of Scope

- Recommending skills from external marketplaces or internet sources.
- Team-level recommendations shared across multiple users.
- Automatic installation of recommended skills without explicit user action.
