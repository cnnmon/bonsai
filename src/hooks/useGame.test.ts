import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGame } from './useGame';
import { GameStructure } from '../types/game';

// Simple test game structure
const testGame: GameStructure = {
  startScene: 'START',
  scenes: [
    {
      label: 'START',
      lines: [
        { type: 'narrative', id: 'n1', text: 'Welcome!' },
        {
          type: 'decision',
          id: 'd1',
          prompt: 'What do you do?',
          options: [
            {
              id: 'o1',
              text: 'Go left',
              lines: [
                { type: 'narrative', id: 'n2', text: 'You went left!' },
                { type: 'jump', id: 'j1', target: 'END' },
              ],
            },
            {
              id: 'o2',
              text: 'Go right',
              lines: [
                { type: 'jump', id: 'j2', target: 'END' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('useGame', () => {
  it('starts at the first line of the start scene', () => {
    const { result } = renderHook(() => useGame(testGame));
    
    expect(result.current.currentLine).not.toBeNull();
    expect(result.current.currentLine?.type).toBe('narrative');
    expect(result.current.status).toBe('playing');
  });

  it('advances through narrative lines', () => {
    const { result } = renderHook(() => useGame(testGame));
    
    // First line is narrative
    expect(result.current.currentLine?.type).toBe('narrative');
    
    act(() => {
      result.current.advance();
    });
    
    // Now at decision
    expect(result.current.currentLine?.type).toBe('decision');
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].type).toBe('narrative');
    expect(result.current.history[0].text).toBe('Welcome!');
  });

  it('matches exact option input', () => {
    const { result } = renderHook(() => useGame(testGame));
    
    // Advance past narrative to decision
    act(() => {
      result.current.advance();
    });
    
    expect(result.current.currentLine?.type).toBe('decision');
    
    // Select option with exact match
    act(() => {
      result.current.advance('Go left');
    });
    
    // Should now be in the option's lines (narrative)
    expect(result.current.currentLine?.type).toBe('narrative');
    if (result.current.currentLine?.type === 'narrative') {
      expect(result.current.currentLine.text).toBe('You went left!');
    }
    
    // History should show the decision
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[1].type).toBe('decision');
    expect(result.current.history[1].chosenOption).toBe('Go left');
  });

  it('matches partial/substring option input', () => {
    const { result } = renderHook(() => useGame(testGame));
    
    // Advance to decision
    act(() => {
      result.current.advance();
    });
    
    // Select with partial match "left" should match "Go left"
    act(() => {
      result.current.advance('left');
    });
    
    expect(result.current.currentLine?.type).toBe('narrative');
  });

  it('matches case-insensitive option input', () => {
    const { result } = renderHook(() => useGame(testGame));
    
    act(() => {
      result.current.advance(); // past narrative
    });
    
    act(() => {
      result.current.advance('GO LEFT'); // uppercase
    });
    
    expect(result.current.currentLine?.type).toBe('narrative');
    if (result.current.currentLine?.type === 'narrative') {
      expect(result.current.currentLine.text).toBe('You went left!');
    }
  });

  it('does not advance if no matching option', () => {
    const { result } = renderHook(() => useGame(testGame));
    
    act(() => {
      result.current.advance(); // past narrative
    });
    
    const historyBefore = result.current.history.length;
    
    act(() => {
      result.current.advance('fly away'); // no match
    });
    
    // Should still be at decision
    expect(result.current.currentLine?.type).toBe('decision');
    expect(result.current.history.length).toBe(historyBefore);
  });

  it('follows jumps to END', () => {
    const { result } = renderHook(() => useGame(testGame));
    
    act(() => {
      result.current.advance(); // narrative
    });
    
    act(() => {
      result.current.advance('Go right'); // select option with just a jump
    });
    
    // Option has just a jump
    expect(result.current.currentLine?.type).toBe('jump');
    
    act(() => {
      result.current.advance(); // follow jump to END
    });
    
    expect(result.current.status).toBe('ended');
  });

  it('can restart the game', () => {
    const { result } = renderHook(() => useGame(testGame));
    
    act(() => {
      result.current.advance(); // narrative
    });
    
    act(() => {
      result.current.advance('Go right');
    });
    
    act(() => {
      result.current.advance(); // jump to END
    });
    
    expect(result.current.status).toBe('ended');
    
    act(() => {
      result.current.restart();
    });
    
    expect(result.current.status).toBe('playing');
    expect(result.current.history).toHaveLength(0);
    expect(result.current.currentLine?.type).toBe('narrative');
  });
});

