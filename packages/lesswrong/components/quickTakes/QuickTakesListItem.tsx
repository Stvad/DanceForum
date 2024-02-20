import React, { useCallback, useState } from "react";
import { registerComponent, Components } from "../../lib/vulcan-lib";
import { useTracking } from "../../lib/analyticsEvents";
import { isFriendlyUI } from "../../themes/forumTheme";
import { isLWorAF } from "../../lib/instanceSettings";

const styles = (_theme: ThemeType) => ({
  expandedRoot: {
    "& .comments-node-root": {
      marginBottom: 8,
      ...(isLWorAF ? { paddingTop: 0 } : {})
    },
  },
});

const QuickTakesListItem = ({quickTake, classes}: {
  quickTake: ShortformComments,
  classes: ClassesType,
}) => {
  const {captureEvent} = useTracking();
  const [expanded, setExpanded] = useState(false);
  const wrappedSetExpanded = useCallback((value: boolean) => {
    setExpanded(value);
    captureEvent(value ? "shortformItemExpanded" : "shortformItemCollapsed");
  }, [captureEvent, setExpanded]);

  const {CommentsNode, QuickTakesCollapsedListItem, LWQuickTakesCollapsedListItem} = Components;

  const CollapsedListItem = isFriendlyUI ? QuickTakesCollapsedListItem : LWQuickTakesCollapsedListItem;

  return expanded
    ? (
      <div className={classes.expandedRoot}>
        <CommentsNode
          treeOptions={{
            post: quickTake.post ?? undefined,
            showCollapseButtons: isFriendlyUI,
            onToggleCollapsed: () => wrappedSetExpanded(!expanded),
          }}
          comment={quickTake}
          loadChildrenSeparately
          forceUnTruncated
          forceUnCollapsed
        />
      </div>
    )
    : <CollapsedListItem quickTake={quickTake} setExpanded={wrappedSetExpanded} />;
}

const QuickTakesListItemComponent = registerComponent(
  "QuickTakesListItem",
  QuickTakesListItem,
  {styles},
);

declare global {
  interface ComponentTypes {
    QuickTakesListItem: typeof QuickTakesListItemComponent
  }
}
