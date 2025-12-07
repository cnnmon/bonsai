import { GameStructure } from '../types/game';
import {
  createNarrativeLine,
  createDecisionLine,
  createJumpLine,
  createOption,
} from '../components/Editor/utils';

// Initial game structure based on README example
// This can be edited in-place and reflected in the editor
// All IDs are auto-generated to remain stable across edits

export const initialGame: GameStructure = {
  startScene: 'FIRE',
  scenes: [
    {
      label: 'FIRE',
      lines: [
        // Future: { type: 'variable', id: generateId(), action: 'set', variable: 'fire', value: true }
        createNarrativeLine('The fire burns brightly.'),
        createDecisionLine('What does the player do?', [
          createOption('Ride a bike', [
            createNarrativeLine("That's cool!"),
            createJumpLine('BIKE'),
          ]),
          createOption('Learn to sail', [
            // Future: { type: 'variable', id: generateId(), action: 'add', variable: 'sailing experience' }
            createNarrativeLine("You're sailing, that's pretty rad"),
          ]),
        ]),
        createNarrativeLine("Okay kid!"),
      ],
    },
    {
      label: 'BIKE',
      lines: [
        createNarrativeLine("You're biking, that's pretty rad"),
        createJumpLine('END'),
      ],
    },
  ],
};
