import { GameStructure } from "../types/game";
import {
  createNarrativeLine,
  createDecisionLine,
  createJumpLine,
  createPromptLine,
  createOption,
} from "../components/Editor/utils";

export const initialGame: GameStructure = {
  startScene: "FIRE",
  scenes: [
    {
      label: "FIRE",
      lines: [
        { ...createPromptLine("Write in a fun, adventurous style with enthusiasm"), id: "GLOBAL_PROMPT_1" },
        { ...createNarrativeLine("The fire burns brightly."), id: "WvKIHTx2rS" },
        {
          ...createDecisionLine("What do you want to do now?", [
            {
              ...createOption(
                ["Ride a bike"],
                [
                  { ...createNarrativeLine("That's cool!"), id: "PDsx_Z8EZE" },
                  { ...createJumpLine("BIKE"), id: "tvifalP-sU" },
                ]
              ),
              id: "Jt_hsbbMyj",
            },
            {
              ...createOption(
                ["Learn to sail"],
                [
                  {
                    ...createNarrativeLine("You're sailing, that's pretty rad"),
                    id: "LOgR2S3Pl3",
                  },
                ]
              ),
              id: "5Mv2xSGDA4",
            },
          ]),
          id: "pa9S6u-ZYh",
        },
        { ...createNarrativeLine("Okay kid!"), id: "btrpfymWIh" },
      ],
    },
    {
      label: "BIKE",
      lines: [
        {
          ...createNarrativeLine("You're biking, that's pretty rad"),
          id: "0wGl_kKyzp",
        },
        { ...createJumpLine("FIRE"), id: "obhQiQK90-" },
      ],
    },
  ],
};
