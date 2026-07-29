---
description: "Immutable architectural invariants, regression prevention rules, and forbidden coding patterns for the VV | MIDI Chord Notator & Sequencer plugin suite."
globs: "src/plugins/chord-notator/**"
alwaysApply: false
---

# 🛡️ VV | Chord Notator — Immutable Architectural Invariants

Any AI developer or coding agent working within `src/plugins/chord-notator/` MUST strictly adhere to these non-negotiable architectural rules. Violating any of these rules will re-introduce critical regressions into polyphonic voice crossing, history traversal, audio sustain, or step sequencer synchronization.

## 1. The 6 "Never-Do" Coding Rules

### I. NEVER Deduplicate or Sort Pitches During Transformation
* **Forbidden:** `new Set(pitches)`, `.sort((a, b) => a - b)` inside `enforcePianoRange`, `handleMidiMessage` (`refresh: true`), or transformation helpers (`applyChromaticShift`, `applyDiatonicShift`, `applyPcsRotation`).
* **Required:** Preserve note arrays in their exact 1-to-1 index order.
* **Why:** Chords must support polyphonic doublings (true unisons) and non-destructive voice crossing. Sorting or deduplicating destroys array index alignment and permanently erases voices.

### II. NEVER Use Greedy Pitch Matching for Selection or Deletion
* **Forbidden:** `targetSelection.includes(note.note)`, `selectedNotes.includes(note.note)` for multi-voice toggling, or `.find(n => n.note === pitch)`.
* **Required:** Always select, highlight, target, and manipulate notes by their unique UUID (`note.id` / `data-id`). When matching external pitch arrays, enforce **1-to-1 cardinality matching** so each target pitch claims at most one unselected voice ID.
* **Why:** Matching by raw MIDI pitch number selects, moves, or erases all unison voices sharing that pitch simultaneously (the "Katamari" multi-voice catching bug).

### III. NEVER Issue Naked `audioEngine.noteOn()` Calls for UI Previews
* **Forbidden:** Calling `audioEngine.noteOn(noteStr, velocity)` directly inside UI click handlers, keyboard shortcuts, or transformation functions without an accompanying guaranteed timer.
* **Required:** Route all interactive UI audio previews through `playPreviewNotes(noteStrings, true, velocity)`.
* **Why:** Naked `noteOn` calls rely on key-up (`APP_TRANSFORM_OFF`) events to release notes. If key-up events are dropped or arrive out of order, voices sustain infinitely. `playPreviewNotes` enforces a strict 500ms self-terminating safety timer.

### IV. NEVER Use Shallow Stack Copies for Undo/Redo
* **Forbidden:** `undoStack.current.push(activeNotes.current.map(n => ({ ...n })))` or shallow array spreading `[...sequence]`.
* **Required:** Every history push and pop across `commitState`, `undo`, `redo`, `commitSeqState`, `undoSeq`, and `redoSeq` MUST use strict deep cloning: `JSON.parse(JSON.stringify(...))`.
* **Why:** Shallow copying allows nested object properties, accidental overrides, and spelling strings to mutate historical snapshots in place.

### V. NEVER Hide DOM Nodes Before Reading Geometry
* **Forbidden:** Adding the `'hidden'` CSS class (`marqueeRef.current.classList.add('hidden')`) before calling `.getBoundingClientRect()`.
* **Required:** Always evaluate `const rect = marqueeRef.current.getBoundingClientRect()` BEFORE applying `'hidden'`.
* **Why:** Adding `'hidden'` (`display: none`) instantly zeroes out the DOM bounding box (`width: 0, height: 0`) in JSDOM and browsers, causing marquee selection intersection tests to fail.

### VI. NEVER Hoist Upstream Broadcasts Above Local Ref Selection
* **Forbidden:** Calling `updateActiveNotes(...)` in `StepSequencer.tsx` before updating `selectedStepRef.current = startStep`.
* **Required:** Always set `setSelectedStep(startStep); selectedStepRef.current = startStep;` BEFORE calling `updateActiveNotes(...)`.
* **Why:** Calling `updateActiveNotes` synchronously broadcasts a `{ refresh: true }` event. If `selectedStepRef.current` still points to the previous bar index, the sequencer will overwrite the bar being left with the new bar's chord (the "Musical Chairs" bar overwrite bug).

---

## 2. Test Tampering & Regression Guardrail

* **Zero Test Tampering:** You are strictly forbidden from modifying, removing, or adding `.skip` / `test.skip` to any existing unit test in `src/plugins/chord-notator/` without explicit human authorization.
* **Regression Definition:** If your code modification causes any test in `npm run test:notator` to fail, your implementation is defective. You must refactor your implementation until all 225+ tests pass cleanly.
