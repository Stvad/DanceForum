import React, { FC, useCallback, useState } from "react";
import { Components, registerComponent } from "../../../lib/vulcan-lib";
import { useCurrentUser } from "../../common/withUser";
import { useUpdateCurrentUser } from "../../hooks/useUpdateCurrentUser";
import { useSingle } from "../../../lib/crud/withSingle";
import { useMulti } from "../../../lib/crud/withMulti";
import { Link } from "../../../lib/reactRouterWrapper";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import type {
  CommentKarmaChange,
  PostKarmaChange,
  TagRevisionKarmaChange,
} from "../../../lib/types/karmaChangesTypes";

const styles = (theme: ThemeType) => ({
  root: {
    fontFamily: theme.palette.fonts.sansSerifStack,
    width: 760,
    maxWidth: "100%",
    margin: "0 auto",
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    margin: "40px 0",
  },
  tabs: {
    marginBottom: 16,
    "& .MuiTabs-flexContainer": {
      gap: "32px",
    },
    "& .MuiTab-root": {
      minWidth: 100,
      [theme.breakpoints.down("xs")]: {
        minWidth: 50,
      },
    },
    "& .MuiTab-labelContainer": {
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: "0.28px",
      textTransform: "uppercase",
    },
  },
  content: {
    display: "flex",
    flexDirection :"column",
    gap: "24px",
    marginTop: 24,
  },
  secondaryText: {
    color: theme.palette.grey[600],
    fontSize: 14,
    fontWeight: 500,
    "& a": {
      color: theme.palette.primary.main,
      fontWeight: 600,
      marginLeft: 10,
    },
  },
});

const tabs = [
  {
    name: "all",
    type: undefined,
  },
  {
    name: "karma",
    type: undefined,
  },
  {
    name: "comments",
    type: "newComment",
  },
  {
    name: "reactions",
    type: undefined,
  },
  {
    name: "new posts",
    type: "newPost",
  },
] as const;

const NotificationsPageKarma: FC<{
  karmaChanges?: UserKarmaChanges,
  classes: ClassesType<typeof styles>,
}> = ({karmaChanges, classes}) => {
  if (!karmaChanges?.karmaChanges) {
    return null;
  }
  const {posts, comments, tagRevisions, updateFrequency} = karmaChanges.karmaChanges;
  const batchedText = updateFrequency === "realtime"
    ? "in real time"
    : `batched ${updateFrequency}`;
  const {NotificationsPageKarmaChange} = Components;
  return (
    <div className={classes.content}>
      <div className={classes.secondaryText}>
        Karma notifications are {batchedText}
        <Link to="/account">Change settings</Link>
      </div>
      {posts.map((post: PostKarmaChange) => (
        <NotificationsPageKarmaChange post={post} />
      ))}
      {comments.map((comment: CommentKarmaChange) => (
        <NotificationsPageKarmaChange comment={comment} />
      ))}
      {tagRevisions.map((tagRevision: TagRevisionKarmaChange) => (
        <NotificationsPageKarmaChange tagRevision={tagRevision} />
      ))}
    </div>
  );
}

export const NotificationsPage = ({classes}: {
  classes: ClassesType<typeof styles>,
}) => {
  const currentUser = useCurrentUser();
  const updateCurrentUser = useUpdateCurrentUser();
  const [tabIndex, setTabIndex] = useState(0);
  const currentTab = tabs[tabIndex] ?? tabs[0];

  const {document: karmaChanges} = useSingle({
    documentId: currentUser?._id,
    collectionName: "Users",
    fragmentName: "UserKarmaChanges",
    skip: !currentUser,
  });

  const {
    results: notifications,
    loading: notificationsLoading,
    // loadMore: loadMoreNotifications, // TODO: Load more
  } = useMulti({
    collectionName: "Notifications",
    fragmentName: "NotificationsList",
    limit: 20,
    enableTotal: false,
    skip: !currentUser,
    terms: {
      view: "userNotifications",
      type: currentTab.type,
      userId: currentUser?._id,
    },
  });

  const onChangeTab = useCallback((_: React.ChangeEvent, tabName: string) => {
    const newTabIndex = tabs.findIndex(({name}) => name === tabName);
    setTabIndex(newTabIndex >= 0 ? newTabIndex : 0);

    if (tabName === "karma" && karmaChanges?.karmaChanges) {
      void updateCurrentUser({
        karmaChangeLastOpened: karmaChanges.karmaChanges.endDate,
        karmaChangeBatchStart: karmaChanges.karmaChanges.startDate,
      });
    }
  }, [karmaChanges?.karmaChanges, updateCurrentUser]);

  if (!currentUser) {
    const {WrappedLoginForm} = Components;
    return (
      <WrappedLoginForm />
    );
  }

  const {Loading, NotificationsPageItem} = Components;
  return (
    <div className={classes.root}>
      <div className={classes.title}>Notifications</div>
      <Tabs
        value={currentTab.name}
        onChange={onChangeTab}
        className={classes.tabs}
        textColor="primary"
        aria-label="select notification type"
        scrollable
        scrollButtons="off"
      >
        {tabs.map(({name}) => (
          <Tab label={name} value={name} key={name} />
        ))}
      </Tabs>
      {currentTab.name === "karma" && karmaChanges &&
        <NotificationsPageKarma karmaChanges={karmaChanges} classes={classes} />
      }
      {currentTab.name !== "karma" && (
        notificationsLoading
          ? <Loading />
          : notifications?.map((item) => (
            <NotificationsPageItem item={item} key={item._id} />
          ))
      )}
    </div>
  );
}

const NotificationsPageComponent = registerComponent(
  "NotificationsPage",
  NotificationsPage,
  {styles},
);

declare global {
  interface ComponentTypes {
    NotificationsPage: typeof NotificationsPageComponent
  }
}
