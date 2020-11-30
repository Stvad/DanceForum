import { registerComponent } from '../../lib/vulcan-lib';
import React from 'react';
import classNames from 'classnames';

import { useDialog } from '../common/withDialog';
import { useTracking } from '../../lib/analyticsEvents';
import { useCurrentUser } from '../common/withUser';
import { TagRels } from '../../lib/collections/tagRels/collection';

const styles = (theme: ThemeType): JssStyles => ({
  root: {
    ...theme.typography.body2,
    ...theme.typography.commentStyle,
    ...theme.typography.smallText,
    marginRight: 16,
    color: theme.palette.grey[600]
  },
  voted: {
    color: theme.palette.grey[900],
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,.1)",
    padding: 6,
    marginTop: -6
  }
})

const TagRelevanceButton = ({document, voteType, vote, label, classes, cancelVote }: {
  document: TagRelMinimumFragment,
  voteType: string,
  vote: any,
  label: React.ReactNode,
  classes: ClassesType,
  cancelVote?: boolean // if this is set, the styling for the voted/non-voted status will be inverted (i.e. you click the button to cancel an existing vote)
}) => {
  const currentUser = useCurrentUser();

  const { openDialog } = useDialog();
  const { captureEvent } = useTracking();

  const wrappedVote = (voteType: string) => {
    if(!currentUser){
      openDialog({
        componentName: "LoginPopup",
        componentProps: {}
      });
    } else {
      vote({document, voteType: voteType, collection: TagRels, currentUser});
      captureEvent("vote", {collectionName: "TagRels"});
    }
  }

  const handleClick = () => {
    wrappedVote(voteType)
  }

  const voted = (document.currentUserVote === voteType)

  return <a className={classNames(classes.root, {[classes.voted]: cancelVote ? !voted : voted})} onClick={handleClick}>
    {label}
  </a>
}

const TagRelevanceButtonComponent = registerComponent('TagRelevanceButton', TagRelevanceButton, {styles});

declare global {
  interface ComponentTypes {
    TagRelevanceButton: typeof TagRelevanceButtonComponent
  }
}

