import React from 'react';
import { Components, registerComponent, getCollectionName } from '../../lib/vulcan-lib';
import { useCreate } from '../../lib/crud/withCreate';
import { useMulti } from '../../lib/crud/withMulti';
import { useMessages } from '../common/withMessages';
import { Subscriptions } from '../../lib/collections/subscriptions/collection'
import { defaultSubscriptionTypeTable } from '../../lib/collections/subscriptions/mutations'
import { userIsDefaultSubscribed } from '../../lib/subscriptionUtil';
import { useCurrentUser } from '../common/withUser';
import Button from '@material-ui/core/Button';
import NotificationsNoneIcon from '@material-ui/icons/NotificationsNone';
import NotificationsIcon from '@material-ui/icons/Notifications';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import classNames from 'classnames';
import { useTracking } from "../../lib/analyticsEvents";
import * as _ from 'underscore';

const styles = (theme: ThemeType): JssStyles => ({
  root: {
    display: "flex",
    alignItems: "center"
  },
  hideOnMobile: {
    [theme.breakpoints.down('sm')]: { //optimized for tag page
      display: "none"
    }
  }
})

const SubscribeButton = ({
  document,
  subscriptionType: overrideSubscriptionType,
  subscribeMessage, unsubscribeMessage,
  className="",
  classes,
}: {
  document: any,
  subscriptionType?: string,
  subscribeMessage?: string,
  unsubscribeMessage?: string,
  className?: string,
  classes: ClassesType,
}) => {
  const currentUser = useCurrentUser();
  const { flash } = useMessages();
  const { create: createSubscription } = useCreate({
    collection: Subscriptions,
    fragmentName: 'SubscriptionState',
  });
  
  const collectionName = getCollectionName(document.__typename);
  const documentType = collectionName.toLowerCase();
  const subscriptionType = overrideSubscriptionType || defaultSubscriptionTypeTable[collectionName];

  const { captureEvent } = useTracking({eventType: "subscribeClicked", eventProps: {documentId: document._id, documentType: documentType}})
  
  // Get existing subscription, if there is one
  const { results, loading } = useMulti({
    terms: {
      view: "subscriptionState",
      documentId: document._id,
      userId: currentUser?._id,
      type: subscriptionType,
      collectionName,
      limit: 1
    },
    
    collectionName: "Subscriptions",
    fragmentName: 'SubscriptionState',
    enableTotal: false,
  });
  
  const isSubscribed = () => {
    return true
  }
  const onSubscribe = async (e) => {
    try {
      e.preventDefault();

      // success message will be for example posts.subscribed
      flash({messageString: `Successfully ${isSubscribed() ? "unsubscribed" : "subscribed"}`});
    } catch(error) {
      flash({messageString: error.message});
    }
  }
  
  const notificationsEnabled = () => {
    // Get the last element of the results array, which will be the most recent subscription
    if (results && results.length > 0) {
      // Get the newest subscription entry (Mingo doesn't enforce the limit:1)
      const currentSubscription = _.max(results, result=>new Date(result.createdAt).getTime());
      
      if (currentSubscription.state === "subscribed")
        return true;
      else if (currentSubscription.state === "suppressed")
        return false;
    }
    return userIsDefaultSubscribed({
      user: currentUser,
      subscriptionType, collectionName, document
    });
  }
  
  const showIcon = isSubscribed() || notificationsEnabled();

  return <div className={classNames(className, classes.root)}>
    <Button variant="outlined" onClick={onSubscribe}>
      <span className={classes.subscribeText}>{ isSubscribed() ? unsubscribeMessage : subscribeMessage}</span>
    </Button>
    {showIcon && <ListItemIcon>
      {loading
        ? <Components.Loading/>
        : (notificationsEnabled()
          ? <NotificationsIcon />
          : <NotificationsNoneIcon />
        )
      }
    </ListItemIcon>}
  </div>
}

const SubscribeButtonComponent = registerComponent('SubscribeButton', SubscribeButton, {styles});

declare global {
  interface ComponentTypes {
    SubscribeButton: typeof SubscribeButtonComponent
  }
}



