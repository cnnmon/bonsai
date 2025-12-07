import { GameStructure } from '../types/game';
import {
  createNarrativeLine,
  createDecisionLine,
  createJumpLine,
  createOption,
} from '../components/Editor/utils';

export const initialGame: GameStructure = {
  startScene: 'FIRE',
  scenes: [
    {
      label: 'FIRE',
      lines: [
        createNarrativeLine('The fire burns brightly.'),
        createDecisionLine('What do you want to do now?', [
          createOption(['Ride a bike'], [
            createNarrativeLine("That's cool!"),
            createJumpLine('BIKE'),
          ]),
          createOption(['Learn to sail'], [
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
        createJumpLine('FIRE'),
      ],
    },
  ],
};
