import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGame } from './useGame';
import { GameStructure, LineType } from '../types/game';
import { 
  createNarrativeLine, 
  createDecisionLine, 
  createJumpLine, 
  createOption 
} from '../components/Editor/utils';

describe('useGame - Cycling Behavior', () => {
  it('should cycle between FIRE and BIKE scenes', () => {
    // Create a game structure that cycles FIRE -> BIKE -> FIRE
    const gameStructure: GameStructure = {
      startScene: 'FIRE',
      scenes: [
        {
          label: 'FIRE',
          lines: [
            createNarrativeLine('The fire burns brightly.'),
            createDecisionLine('What story do you want to tell around the fire?', [
              createOption('Ride a bike', [
                createNarrativeLine("That's cool!"),
                createJumpLine('BIKE'),
              ]),
              createOption('Learn to sail', [
                createNarrativeLine("You're sailing, that's pretty rad"),
              ]),
            ]),
            createNarrativeLine('Okay kid!'),
          ],
        },
        {
          label: 'BIKE',
          lines: [
            createNarrativeLine("You're biking, that's pretty rad"),
            createJumpLine('FIRE'),
          ],
        },
      ],
    };

    const { result } = renderHook(() => useGame(gameStructure));

    // Initial state - should be at FIRE scene
    expect(result.current.currentScene?.label).toBe('FIRE');
    expect(result.current.history).toHaveLength(0);

    // Step 1: Advance through first narrative
    act(() => {
      result.current.advance();
    });
    // History should have narrative + decision (auto-added when reached)
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0].text).toBe('The fire burns brightly.');
    expect(result.current.history[1].text).toBe('What story do you want to tell around the fire?');

    // Step 2: Should now be at decision
    expect(result.current.currentLineType).toBe(LineType.DECISION);

    // Step 3: Choose "Ride a bike" option
    act(() => {
      result.current.advance('Ride a bike');
    });
    expect(result.current.history[1].chosenOption).toBe('Ride a bike');

    // Step 4: Should process "That's cool!" narrative inside the option
    act(() => {
      result.current.advance();
    });
    expect(result.current.history).toHaveLength(3);
    expect(result.current.history[2].text).toBe("That's cool!");

    // Step 5: Should hit the jump to BIKE
    act(() => {
      result.current.advance();
    });
    
    // Should now be at BIKE scene
    expect(result.current.currentScene?.label).toBe('BIKE');

    // Step 6: Should process BIKE's narrative
    act(() => {
      result.current.advance();
    });
    expect(result.current.history[result.current.history.length - 1].text).toBe("You're biking, that's pretty rad");

    // Step 7: Should hit jump back to FIRE
    act(() => {
      result.current.advance();
    });
    
    // Should be back at FIRE scene
    expect(result.current.currentScene?.label).toBe('FIRE');
    
    // Step 8: Should process first narrative again
    act(() => {
      result.current.advance();
    });
    
    // The narrative should appear again in history (cycling works!)
    const narrativeCount = result.current.history.filter(
      entry => entry.text === 'The fire burns brightly.'
    ).length;
    expect(narrativeCount).toBe(2); // Should have seen it twice now
    
    // Should be back at the decision in FIRE scene
    expect(result.current.currentScene?.label).toBe('FIRE');
    expect(result.current.currentLineType).toBe(LineType.DECISION);
  });

  it('should handle simple jump and return', () => {
    const gameStructure: GameStructure = {
      startScene: 'START',
      scenes: [
        {
          label: 'START',
          lines: [
            createNarrativeLine('Beginning'),
            createJumpLine('OTHER'),
            createNarrativeLine('After jump'),
          ],
        },
        {
          label: 'OTHER',
          lines: [
            createNarrativeLine('In other scene'),
          ],
        },
      ],
    };

    const { result } = renderHook(() => useGame(gameStructure));

    // Process beginning narrative
    act(() => result.current.advance());
    expect(result.current.history[0].text).toBe('Beginning');

    // Process jump
    act(() => result.current.advance());
    expect(result.current.currentScene?.label).toBe('OTHER');

    // Process other scene narrative
    act(() => result.current.advance());
    expect(result.current.history[1].text).toBe('In other scene');

    // Should return to START after OTHER
    act(() => result.current.advance());
    expect(result.current.currentScene?.label).toBe('START');

    // Should process "After jump" narrative
    act(() => result.current.advance());
    expect(result.current.history[2].text).toBe('After jump');
  });
});

