import * as _ from 'underscore';

export const groupTypes = [
  {
    shortName: "LW",
    longName: "LessWrong",
  },
  {
    shortName: "SSC",
    longName: "Slate Star Codex",
  },
  {
    shortName: "EA",
    longName: "Effective Altruism",
  },
  {
    shortName: "MIRIx",
    longName: "MIRIx",
  },
  {
    shortName: "AI",
    longName: "AI Alignment",
  }
];

export const localGroupTypeFormOptions = _.map(groupTypes,
  groupType => {
    return {
      value: groupType.shortName,
    };
  }
);
