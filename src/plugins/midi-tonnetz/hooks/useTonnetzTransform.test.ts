import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTonnetzTransform, transformReducer } from './useTonnetzTransform';

describe('useTonnetzTransform - Phase 1 Engine State & Initialization', () => {
  it('Test Case 1: Given a C Major chord (0, 4, 7), When initialized, Assert r = 0, I = [0, 4, 7], F = 0', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7]));
    });

    expect(result.current.state.r).toBe(0);
    expect(result.current.state.I).toEqual([0, 4, 7]);
    expect(result.current.state.F).toBe(0);
  });

  it('Test Case 2: Given an inversion (4, 7, 0), When initialized, Assert it sorts to (0, 4, 7) yielding the same blueprint', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([4, 7, 0]));
    });

    expect(result.current.state.r).toBe(0);
    expect(result.current.state.I).toEqual([0, 4, 7]);
    expect(result.current.state.F).toBe(0);
  });
});

describe('useTonnetzTransform - Phase 2 Core Matrix Operations', () => {
  it('Test Case 1 (Matrix 1): Given I=[0,4,7], r=0, F=0 (C Major), When direction is RIGHT, Assert r_new=4, F_new=1, and output is (4, 11, 7) or E Minor', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7]));
    });

    act(() => {
      result.current.handleDirectionalTrigger('RIGHT');
    });

    expect(result.current.state.r).toBe(4);
    expect(result.current.state.F).toBe(1);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([4, 7, 11]);
  });

  it('Test Case 2 (Matrix 2): Given previous state r=4, F=1 (E Minor), When direction is UP, Assert r_new=4, F_new=0, and output is (4, 8, 11) or E Major', async () => {
    const { result } = renderHook(() => useTonnetzTransform());

    // We can initialize it, then manually move it to E minor
    act(() => {
      result.current.initTransformState(new Set([0, 4, 7]));
    });

    act(() => {
      result.current.handleDirectionalTrigger('RIGHT'); // Moves to E Minor (r=4, F=1)
    });

    expect(result.current.state.r).toBe(4);
    expect(result.current.state.F).toBe(1);

    await new Promise(r => setTimeout(r, 60));

    act(() => {
      result.current.handleDirectionalTrigger('UP'); // Moves to E Major (r=4, F=0)
    });

    expect(result.current.state.r).toBe(4);
    expect(result.current.state.F).toBe(0);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([4, 8, 11]);
  });

  it('Round trip: Given C Major (0, 4, 7), When navigated UP then DOWN, Assert it returns to C Major', async () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7]));
    });

    act(() => { result.current.handleDirectionalTrigger('UP'); });
    await new Promise(r => setTimeout(r, 60));
    act(() => { result.current.handleDirectionalTrigger('DOWN'); });

    expect(result.current.state.r).toBe(0);
    expect(result.current.state.F).toBe(0);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });

  it('Round trip: Given C Major (0, 4, 7), When navigated RIGHT then LEFT, Assert it returns to C Major', async () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7]));
    });

    act(() => { result.current.handleDirectionalTrigger('RIGHT'); });
    await new Promise(r => setTimeout(r, 60));
    act(() => { result.current.handleDirectionalTrigger('LEFT'); });

    expect(result.current.state.r).toBe(0);
    expect(result.current.state.F).toBe(0);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });

  it('Round trip: Given C Major (0, 4, 7), When navigated LEFT then RIGHT, Assert it returns to C Major', async () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7]));
    });

    act(() => { result.current.handleDirectionalTrigger('LEFT'); });
    await new Promise(r => setTimeout(r, 60));
    act(() => { result.current.handleDirectionalTrigger('RIGHT'); });

    expect(result.current.state.r).toBe(0);
    expect(result.current.state.F).toBe(0);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });

  it('Round trip: Given C Major (0, 4, 7), When navigated DOWN then UP, Assert it returns to C Major', async () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7]));
    });

    act(() => { result.current.handleDirectionalTrigger('DOWN'); });
    await new Promise(r => setTimeout(r, 60));
    act(() => { result.current.handleDirectionalTrigger('UP'); });

    expect(result.current.state.r).toBe(0);
    expect(result.current.state.F).toBe(0);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });
});

describe('useTonnetzTransform - PRP 19 Matrix 2 routing audit', () => {
  it('Test Case 1: Given Engine state r=9, F=1 (A Minor), When direction LEFT is triggered, Assert r_new=5, F_new=0 (F Major)', async () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7])); // Start at C Major (r=0, F=0)
    });

    act(() => {
      result.current.handleDirectionalTrigger('LEFT'); // Moves to A Minor (r=9, F=1)
    });

    expect(result.current.state.r).toBe(9);
    expect(result.current.state.F).toBe(1);

    await new Promise(r => setTimeout(r, 60));

    act(() => {
      result.current.handleDirectionalTrigger('LEFT'); // Moves to F Major (r=5, F=0)
    });

    expect(result.current.state.r).toBe(5);
    expect(result.current.state.F).toBe(0);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([0, 5, 9]); // F Major: F=5, A=9, C=0
  });

  it('Test Case 2: Given Engine state r=9, F=1 (A Minor), When direction UP is triggered, Assert r_new=9, F_new=0 (A Major)', async () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7])); // C Major
    });

    act(() => {
      result.current.handleDirectionalTrigger('LEFT'); // Moves to A Minor (r=9, F=1)
    });

    expect(result.current.state.r).toBe(9);
    expect(result.current.state.F).toBe(1);

    await new Promise(r => setTimeout(r, 60));

    act(() => {
      result.current.handleDirectionalTrigger('UP'); // Moves to A Major (r=9, F=0)
    });

    expect(result.current.state.r).toBe(9);
    expect(result.current.state.F).toBe(0);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([1, 4, 9]); // A Major: A=9, C#=1, E=4
  });
});

describe('useTonnetzTransform - PRP 20 Phase 1 Engine State Routing Audit', () => {
  it('Test Case 1: Given Engine state r=0, F=0 (C Major), When internal direction UP is triggered, Assert r_new=1, F_new=1 (C# Minor)', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7])); // C Major (r=0, F=0)
    });

    act(() => {
      result.current.handleDirectionalTrigger('UP'); // Moves to C# Minor (r=1, F=1)
    });

    expect(result.current.state.r).toBe(1);
    expect(result.current.state.F).toBe(1);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([1, 4, 8]); // C# Minor: C#=1, E=4, G#=8
  });
});

describe('useTonnetzTransform - PRP 21 Phase 1 Diagonal Polarity Audit', () => {
  it('Test Case 1: Given Engine state r=0, F=0 (C Major), When internal direction UP_RIGHT is triggered, Assert r_new=4, F_new=0 (E Major)', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7]));
    });

    act(() => {
      result.current.handleDirectionalTrigger('UP_RIGHT');
    });

    expect(result.current.state.r).toBe(4);
    expect(result.current.state.F).toBe(0);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([4, 8, 11]); // E Major: E=4, G#=8, B=11
  });

  it('Test Case 2: Given Engine state r=0, F=0 (C Major), When internal direction UP_LEFT is triggered, Assert r_new=9, F_new=0 (A Major)', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7]));
    });

    act(() => {
      result.current.handleDirectionalTrigger('UP_LEFT');
    });

    expect(result.current.state.r).toBe(9);
    expect(result.current.state.F).toBe(0);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([1, 4, 9]); // A Major: A=9, C#=1, E=4
  });
});

describe('useTonnetzTransform - PRP 22 Phase 1 7th Chord State Initialization', () => {
  it('Test Case 1: Given input set (0, 4, 7, 11) - Cmaj7, Assert seventhRoot = 0, seventhIsFlipped = false', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7, 11]));
    });

    expect(result.current.seventhState.seventhRoot).toBe(0);
    expect(result.current.seventhState.seventhIsFlipped).toBe(false);
  });
});

describe('useTonnetzTransform - PRP 22 Phase 2 State 1 (Major 7th) Routing Matrix', () => {
  it('Test Case 1 (Chromatic Slide): Given Root=0, isFlipped=false (C∆), When UP triggered, Assert Root=1, isFlipped=true (C#m7)', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7, 11]));
    });

    act(() => {
      result.current.handleDirectionalTrigger('UP');
    });

    expect(result.current.seventhState.seventhRoot).toBe(1);
    expect(result.current.seventhState.seventhIsFlipped).toBe(true);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([1, 4, 8, 11]); // C#m7: C#=1, E=4, G#=8, B=11
  });

  it('Test Case 2 (LUM Cycle): Given Root=0, isFlipped=false (C∆), When RIGHT triggered, Assert Root=4, isFlipped=true (Em7)', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7, 11]));
    });

    act(() => {
      result.current.handleDirectionalTrigger('RIGHT');
    });

    expect(result.current.seventhState.seventhRoot).toBe(4);
    expect(result.current.seventhState.seventhIsFlipped).toBe(true);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([2, 4, 7, 11]); // Em7: E=4, G=7, B=11, D=2
  });
});

describe('useTonnetzTransform - PRP 22 Phase 3 State 2 (Minor 7th) Routing Matrix', () => {
  it('Test Case 1 (Chromatic Slide pt 2): Given Root=1, isFlipped=true (C#m7), When UP triggered, Assert Root=1, isFlipped=false (Db∆)', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([1, 4, 8, 11])); // C#m7
    });

    act(() => {
      result.current.handleDirectionalTrigger('UP');
    });

    expect(result.current.seventhState.seventhRoot).toBe(1);
    expect(result.current.seventhState.seventhIsFlipped).toBe(false);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([0, 1, 5, 8]); // Db∆: Db=1, F=5, Ab=8, C=0
  });

  it('Test Case 2 (LUM Cycle pt 2): Given Root=4, isFlipped=true (Em7), When RIGHT triggered, Assert Root=7, isFlipped=false (G∆)', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([2, 4, 7, 11])); // Em7
    });

    act(() => {
      result.current.handleDirectionalTrigger('RIGHT');
    });

    expect(result.current.seventhState.seventhRoot).toBe(7);
    expect(result.current.seventhState.seventhIsFlipped).toBe(false);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([2, 6, 7, 11]); // G∆: G=7, B=11, D=2, F#=6
  });
});

describe('useTonnetzTransform - PRP 23 Phase 1 Decouple State Setters', () => {
  it('Test Case 1: Given a Cmaj7 shape active, When handleDirectionalTrigger("UP") fires, Assert seventhState updates exactly once to Root 1, isFlipped true (C#m7)', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7, 11]));
    });

    act(() => {
      result.current.handleDirectionalTrigger('UP');
    });

    expect(result.current.seventhState.seventhRoot).toBe(1);
    expect(result.current.seventhState.seventhIsFlipped).toBe(true);
  });
});

describe('useTonnetzTransform - PRP 24 Phase 1 State Validity Flag Initialization', () => {
  it('Test Case 1: Given C7 input (0, 4, 7, 10), When initTransformState runs, Assert seventhState.seventhIsActive is false', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7, 10])); // C7 (Dominant)
    });

    expect(result.current.seventhState.seventhIsActive).toBe(false);
  });

  it('Test Case 2: Given Cmaj7 input (0, 4, 7, 11), When initTransformState runs, Assert seventhState.seventhIsActive is true', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7, 11])); // Cmaj7
    });

    expect(result.current.seventhState.seventhIsActive).toBe(true);
  });
});

describe('useTonnetzTransform - PRP 24 Phase 2 Route getOutputNotes Safely', () => {
  it('Test Case 1: Given C7 in state with seventhIsActive = false, When getOutputNotes fires, Assert it calculates output via I.map(note => mod12(r + note))', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7, 10])); // C7
    });

    expect(result.current.seventhState.seventhIsActive).toBe(false);
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([0, 4, 7, 10]); // Unchanged output (Operation A)
  });
});

describe('useTonnetzTransform - PRP 24 Phase 3 Route handleDirectionalTrigger Safely', () => {
  it('Test Case 1: Given C7 in state with seventhIsActive = false, When handleDirectionalTrigger("RIGHT") fires, Assert it routes through MATRIX_1 and shifts root by delta_r', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 4, 7, 10])); // C7
    });

    act(() => {
      result.current.handleDirectionalTrigger('RIGHT');
    });

    expect(result.current.state.r).toBe(4); // MATRIX_1 RIGHT delta_r is 4
    expect(result.current.state.F).toBe(1); // MATRIX_1 RIGHT F_new is 1
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([1, 4, 7, 11]); // (4 - I + 7) mod 12 -> [1, 4, 7, 11]
  });
});

describe('useTonnetzTransform - PRP 25 Phase 1 Direct Logic Wire-up', () => {
  it('Test Case 1: Given Maj9 (Root 0, isFlipped false), When UP triggered, Assert Root 1, isFlipped true (Min9)', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 2, 4, 7, 11])); // Cmaj9: C=0, D=2, E=4, G=7, B=11
    });

    expect(result.current.seventhState.seventhRoot).toBe(0);
    expect(result.current.seventhState.seventhIsFlipped).toBe(false);
    expect(result.current.seventhState.seventhIsActive).toBe(true);

    act(() => {
      result.current.handleDirectionalTrigger('UP');
    });

    expect(result.current.seventhState.seventhRoot).toBe(1);
    expect(result.current.seventhState.seventhIsFlipped).toBe(true);
  });

  it('Test Case 2: Given Maj9 (Root 0, isFlipped false), When RIGHT triggered, Assert Root 4, isFlipped true (Min9)', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 2, 4, 7, 11])); // Cmaj9
    });

    act(() => {
      result.current.handleDirectionalTrigger('RIGHT');
    });

    expect(result.current.seventhState.seventhRoot).toBe(4);
    expect(result.current.seventhState.seventhIsFlipped).toBe(true);
  });
});

describe('useTonnetzTransform - PRP 25 Phase 2 Interval Mapping Enforcement', () => {
  it('Test Case 1: Given quality "∆9", When getOutputNotes executes, Assert the output is a 5-note array with the correct intervals', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 2, 4, 7, 11])); // Cmaj9
    });

    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 11]);
  });
});

describe('useTonnetzTransform - PRP 26 Phase 1 Logic Synchronization', () => {
  it('Test Case 1: Given 13th chord state, When RIGHT direction is clicked, Assert state updates correctly and immediately', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      // 13th chord: Cmaj13#11 -> C=0, D=2, E=4, F#=6, G=7, A=9, B=11
      result.current.initTransformState(new Set([0, 2, 4, 6, 7, 9, 11]));
    });

    expect(result.current.seventhState.seventhRoot).toBe(0);
    expect(result.current.seventhState.seventhIsFlipped).toBe(false);

    act(() => {
      result.current.handleDirectionalTrigger('RIGHT');
    });

    expect(result.current.seventhState.seventhRoot).toBe(4);
    expect(result.current.seventhState.seventhIsFlipped).toBe(true);
  });
});

describe('useTonnetzTransform - PRP 26 Phase 2 Input Debouncing/Validation', () => {
  it('Test Case 1 (Debounce): Given two rapid RIGHT clicks <50ms apart, Assert only the first registers', async () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      result.current.initTransformState(new Set([0, 2, 4, 6, 7, 9, 11]));
    });

    expect(result.current.seventhState.seventhRoot).toBe(0);
    expect(result.current.seventhState.seventhIsFlipped).toBe(false);

    act(() => {
      result.current.handleDirectionalTrigger('RIGHT');
      result.current.handleDirectionalTrigger('RIGHT'); // Should be ignored
    });

    expect(result.current.seventhState.seventhRoot).toBe(4);
    expect(result.current.seventhState.seventhIsFlipped).toBe(true);

    // Wait >50ms
    await new Promise(resolve => setTimeout(resolve, 60));

    act(() => {
      result.current.handleDirectionalTrigger('RIGHT'); // Now should register
    });

    expect(result.current.seventhState.seventhRoot).toBe(7);
    expect(result.current.seventhState.seventhIsFlipped).toBe(false);
  });
});

describe('useTonnetzTransform - PRP 27 Phase 1 Atomic Reducer Migration', () => {
  it('Test Case 1: Given a 13th chord state, When the DIRECTION action is dispatched, Assert that the reducer returns updated root and intervals in the same cycle', () => {
    // Import transformReducer inside test or call it directly.
    // Let's mock a 13th chord state.
    // Cmaj13#11 -> root=0, isFlipped=false, intervals=[0, 4, 7, 11, 2, 6, 9]
    const initialState = {
      I: [0, 2, 4, 6, 7, 9, 11],
      r: 0,
      F: 0 as const,
      seventhRoot: 0,
      seventhIsFlipped: false,
      seventhIsActive: true,
      seventhIntervals: [0, 4, 7, 11, 2, 6, 9]
    };

    const nextState = transformReducer(initialState, { type: 'DIRECTION', direction: 'RIGHT' });

    // Right on Maj13 -> shifts root by +4 and flips -> Root 4, Min13.
    // Min13 intervals -> [0, 3, 7, 10, 2, 5, 9]
    expect(nextState.seventhRoot).toBe(4);
    expect(nextState.seventhIsFlipped).toBe(true);
    expect(nextState.seventhIntervals).toEqual([0, 3, 7, 10, 2, 5, 9]);
  });
});

describe('useTonnetzTransform - PRP 27 Phase 2 React Hook Synchronization', () => {
  it('Test Case 1: Given a 13th chord, When a directional click occurs, Assert getOutputNotes generates the correct notes based on the atomic state update', () => {
    const { result } = renderHook(() => useTonnetzTransform());

    act(() => {
      // 13th chord: Cmaj13#11
      result.current.initTransformState(new Set([0, 2, 4, 6, 7, 9, 11]));
    });

    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([0, 2, 4, 6, 7, 9, 11]);

    act(() => {
      result.current.handleDirectionalTrigger('RIGHT');
    });

    // Root 4, Flipped quality (Min13): [4, 7, 11, 2, 6, 9, 1] relative to root 4
    // intervals: [0, 3, 7, 10, 2, 5, 9] -> [4, 7, 11, 2, 6, 9, 1]
    expect(result.current.getOutputNotes().sort((a, b) => a - b)).toEqual([1, 2, 4, 6, 7, 9, 11]);
  });
});











