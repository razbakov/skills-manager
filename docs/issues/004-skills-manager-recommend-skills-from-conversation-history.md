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

This recommendation task is not fully deterministic. The app should prepare and
clean conversation context, then ask a language model to produce the final
recommendations and reasoning.

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
- The app prepares recommendation context by collecting relevant conversation
  history and skill metadata, and by removing known noise (for example repeated
  instruction blocks) before sending it to the language model.
- The final recommendation list is produced by the language model response, not
  by fixed keyword-scoring or hard-coded ranking rules.
- In "Explore New" mode, the prompt asks the language model to prioritize
  unused and low-use skills when they fit the user's repeated themes.
- In "Current Project" scope, only conversation context for the active project
  is sent to the language model.

### Actions and Feedback

- From a recommendation, the user can open the skill for review and install it
  directly if it is not already installed.
- If recommendation generation fails (for example model timeout or invalid
  output), the view shows a clear retry message and keeps the previous results
  unchanged.

## Out of Scope

- Recommending skills from external marketplaces or internet sources.
- Team-level recommendations shared across multiple users.
- Automatic installation of recommended skills without explicit user action.
- Building deterministic recommendation algorithms as the source of truth for
  final ranking.
