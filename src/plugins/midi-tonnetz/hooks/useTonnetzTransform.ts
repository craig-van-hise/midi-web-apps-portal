import { useReducer, useCallback, useEffect, useRef } from 'react';

export interface TransformState {
  I: number[];
  r: number;
  F: 0 | 1;
  seventhRoot: number;
  seventhIsFlipped: boolean;
  seventhIsActive: boolean;
  seventhIntervals: number[];
}

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

interface DirectionMapping {
  delta_r: number;
  F_new: 0 | 1;
}

const MATRIX_1: Record<string, DirectionMapping> = {
  UP: { delta_r: 1, F_new: 1 },
  DOWN: { delta_r: 0, F_new: 1 },
  LEFT: { delta_r: 9, F_new: 1 },
  RIGHT: { delta_r: 4, F_new: 1 },
  UP_LEFT: { delta_r: 9, F_new: 0 },
  UP_RIGHT: { delta_r: 4, F_new: 0 },
  DOWN_LEFT: { delta_r: 8, F_new: 0 },
  DOWN_RIGHT: { delta_r: 3, F_new: 0 },
};

const MATRIX_2: Record<string, DirectionMapping> = {
  UP: { delta_r: 0, F_new: 0 },
  UP_RIGHT: { delta_r: 4, F_new: 1 },
  RIGHT: { delta_r: 3, F_new: 0 },
  DOWN_RIGHT: { delta_r: 3, F_new: 1 },
  DOWN: { delta_r: 11, F_new: 0 },
  DOWN_LEFT: { delta_r: 8, F_new: 1 },
  LEFT: { delta_r: 8, F_new: 0 },
  UP_LEFT: { delta_r: 9, F_new: 1 },
};

export type TransformAction =
  | { type: 'INIT'; activePitchClasses: Set<number> }
  | { type: 'DIRECTION'; direction: string };

export function initReducerState(activePitchClasses: Set<number>): TransformState {
  if (activePitchClasses.size === 0) {
    return {
      I: [],
      r: 0,
      F: 0,
      seventhRoot: 0,
      seventhIsFlipped: false,
      seventhIsActive: false,
      seventhIntervals: [],
    };
  }
  const sorted = Array.from(activePitchClasses).sort((a, b) => a - b);
  const r = sorted[0];
  const I = sorted.map(note => mod12(note - r));

  let seventhRoot = 0;
  let seventhIsFlipped = false;
  let seventhIsActive = false;
  let seventhIntervals: number[] = [];

  if (activePitchClasses.size >= 4 && activePitchClasses.size <= 7) {
    let foundValid7th = false;
    const arr = Array.from(activePitchClasses);
    const size = activePitchClasses.size;
    
    let baseIntervals: number[] = [];
    let flippedIntervals: number[] = [];
    
    if (size === 4) {
      baseIntervals = [0, 4, 7, 11];
      flippedIntervals = [0, 3, 7, 10];
    } else if (size === 5) {
      baseIntervals = [0, 4, 7, 11, 2];
      flippedIntervals = [0, 3, 7, 10, 2];
    } else if (size === 6) {
      baseIntervals = [0, 4, 7, 11, 2, 6];
      flippedIntervals = [0, 3, 7, 10, 2, 5];
    } else if (size === 7) {
      baseIntervals = [0, 4, 7, 11, 2, 6, 9];
      flippedIntervals = [0, 3, 7, 10, 2, 5, 9];
    }

    for (const rootCandidate of arr) {
      const checkMaj = baseIntervals.every(interval => activePitchClasses.has(mod12(rootCandidate + interval)));
      if (checkMaj) {
        foundValid7th = true;
        seventhRoot = rootCandidate;
        seventhIsFlipped = false;
        seventhIsActive = true;
        seventhIntervals = baseIntervals;
        break;
      }

      const checkMin = flippedIntervals.every(interval => activePitchClasses.has(mod12(rootCandidate + interval)));
      if (checkMin) {
        foundValid7th = true;
        seventhRoot = rootCandidate;
        seventhIsFlipped = true;
        seventhIsActive = true;
        seventhIntervals = flippedIntervals;
        break;
      }
    }
  }

  return {
    I,
    r,
    F: 0,
    seventhRoot,
    seventhIsFlipped,
    seventhIsActive,
    seventhIntervals,
  };
}

export function transformReducer(state: TransformState, action: TransformAction): TransformState {
  switch (action.type) {
    case 'INIT':
      return initReducerState(action.activePitchClasses);
    case 'DIRECTION': {
      const { direction } = action;
      if (state.I.length >= 4 && state.seventhIsActive) {
        const isFlipped = state.seventhIsFlipped;
        const R = state.seventhRoot;
        let newRoot = R;
        let newFlipped = isFlipped;

        if (!isFlipped) {
          // State 1 (Major 7th base logic applied to extended chords)
          switch (direction) {
            case 'UP': newRoot = R + 1; newFlipped = true; break;
            case 'UP_RIGHT': newRoot = R + 4; newFlipped = false; break;
            case 'RIGHT': newRoot = R + 4; newFlipped = true; break;
            case 'DOWN_RIGHT': newRoot = R + 3; newFlipped = false; break;
            case 'DOWN': newRoot = R + 0; newFlipped = true; break;
            case 'DOWN_LEFT': newRoot = R + 8; newFlipped = false; break;
            case 'LEFT': newRoot = R + 9; newFlipped = true; break;
            case 'UP_LEFT': newRoot = R + 9; newFlipped = false; break;
          }
        } else {
          // State 2 (Minor 7th base logic applied to extended chords)
          switch (direction) {
            case 'UP': newRoot = R + 0; newFlipped = false; break;
            case 'UP_RIGHT': newRoot = R + 4; newFlipped = true; break;
            case 'RIGHT': newRoot = R + 3; newFlipped = false; break;
            case 'DOWN_RIGHT': newRoot = R + 3; newFlipped = true; break;
            case 'DOWN': newRoot = R + 11; newFlipped = false; break;
            case 'DOWN_LEFT': newRoot = R + 8; newFlipped = true; break;
            case 'LEFT': newRoot = R + 8; newFlipped = false; break;
            case 'UP_LEFT': newRoot = R + 9; newFlipped = true; break;
          }
        }

        const nextRoot = mod12(newRoot);
        const size = state.I.length;
        let nextIntervals: number[] = [];
        if (size === 4) {
          nextIntervals = !newFlipped ? [0, 4, 7, 11] : [0, 3, 7, 10];
        } else if (size === 5) {
          nextIntervals = !newFlipped ? [0, 4, 7, 11, 2] : [0, 3, 7, 10, 2];
        } else if (size === 6) {
          nextIntervals = !newFlipped ? [0, 4, 7, 11, 2, 6] : [0, 3, 7, 10, 2, 5];
        } else if (size === 7) {
          nextIntervals = !newFlipped ? [0, 4, 7, 11, 2, 6, 9] : [0, 3, 7, 10, 2, 5, 9];
        }

        return {
          ...state,
          seventhRoot: nextRoot,
          seventhIsFlipped: newFlipped,
          seventhIntervals: nextIntervals,
        };
      }

      if (state.I.length === 0) return state;
      const matrix = state.F === 0 ? MATRIX_1 : MATRIX_2;
      const mapping = matrix[direction];
      if (!mapping) return state;

      return {
        ...state,
        r: mod12(state.r + mapping.delta_r),
        F: mapping.F_new,
      };
    }
    default:
      return state;
  }
}

const initialTransformState: TransformState = {
  I: [],
  r: 0,
  F: 0,
  seventhRoot: 0,
  seventhIsFlipped: false,
  seventhIsActive: false,
  seventhIntervals: [],
};

export function deriveOutputNotes(state: TransformState): number[] {
  const { I, r, F, seventhRoot, seventhIsActive, seventhIntervals } = state;
  if (I.length === 0) return [];

  if (I.length >= 4 && seventhIsActive) {
    return seventhIntervals.map(interval => mod12(seventhRoot + interval));
  }

  if (F === 0) {
    return I.map(note => mod12(r + note));
  } else {
    return I.map(note => mod12(r - note + 7));
  }
}

export function useTonnetzTransform() {
  const [state, dispatch] = useReducer(transformReducer, initialTransformState);
  const isProcessingRef = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (state.seventhIsActive) {
      console.log(`[useTonnetzTransform] Root: ${state.seventhRoot}, Flipped: ${state.seventhIsFlipped}`);
    }
  }, [state.seventhRoot, state.seventhIsFlipped, state.seventhIsActive]);

  const initTransformState = useCallback((activePitchClasses: Set<number>) => {
    dispatch({ type: 'INIT', activePitchClasses });
    // Synchronously track stateRef
    const nextState = transformReducer(stateRef.current, { type: 'INIT', activePitchClasses });
    stateRef.current = nextState;
  }, []);

  const handleDirectionalTrigger = useCallback((direction: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 50);

    dispatch({ type: 'DIRECTION', direction });
  }, []);

  const triggerDirectionalTransform = useCallback((direction: string): number[] => {
    if (isProcessingRef.current) return deriveOutputNotes(stateRef.current);
    isProcessingRef.current = true;
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 50);

    const nextState = transformReducer(stateRef.current, { type: 'DIRECTION', direction });
    stateRef.current = nextState;
    dispatch({ type: 'DIRECTION', direction });
    return deriveOutputNotes(nextState);
  }, []);

  const getOutputNotes = useCallback(() => {
    return deriveOutputNotes(state);
  }, [state]);

  return {
    state: {
      I: state.I,
      r: state.r,
      F: state.F,
    },
    seventhState: {
      seventhRoot: state.seventhRoot,
      seventhIsFlipped: state.seventhIsFlipped,
      seventhIsActive: state.seventhIsActive,
    },
    initTransformState,
    handleDirectionalTrigger,
    triggerDirectionalTransform,
    getOutputNotes,
  };
}
