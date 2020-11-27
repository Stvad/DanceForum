import { registerFragment } from '../../vulcan-lib';

registerFragment(`
  fragment GardenCodeFragment on GardenCode {
    _id
    code
    title
    userId
    deleted
    slug
    startTime
    endTime
    type
    contents {
      ...RevisionDisplay
    }
  }
`);

registerFragment(`
  fragment GardenCodeFragmentEdit on GardenCode {
    _id
    code
    title
    userId
    deleted
    slug
    startTime
    endTime
    type
    contents {
      ...RevisionEdit
    }
  }
`);

