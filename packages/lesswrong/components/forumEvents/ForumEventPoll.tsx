import React, { useCallback, useState } from "react";
import { Components, registerComponent } from "../../lib/vulcan-lib";
import classNames from "classnames";
import { useCurrentUser } from "../common/withUser";
import { useEventListener } from "../hooks/useEventListener";
import { gql, useMutation } from "@apollo/client";
import { useDialog } from "../common/withDialog";
import { useMulti } from "@/lib/crud/withMulti";
import ForumNoSSR from "../common/ForumNoSSR";

const SLIDER_WIDTH = 1000;
const USER_IMAGE_SIZE = 24;

const styles = (theme: ThemeType) => ({
  root: {
    textAlign: 'center',
    padding: '10px 30px 30px',
    margin: '0 auto',
    ['@media(max-width: 1040px)']: {
      display: 'none'
    },
  },
  question: {
    fontSize: 32,
    lineHeight: '110%',
    fontWeight: 700,
  },
  questionFootnote: {
    fontSize: 20,
    verticalAlign: 'super',
  },
  sliderRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 36,
  },
  sliderLine: {
    position: 'relative',
    width: SLIDER_WIDTH,
    height: 2,
    backgroundColor: theme.palette.text.alwaysWhite,
  },
  sliderArrow: {
    transform: 'translateY(-11px)',
    stroke: theme.palette.text.alwaysWhite,
  },
  sliderArrowLeft: {
    marginRight: -15,
  },
  sliderArrowRight: {
    marginLeft: -15,
  },
  userVote: {
    position: 'absolute',
    top: -USER_IMAGE_SIZE/2,
    zIndex: 1,
  },
  currentUserVote: {
    opacity: 0.6,
    cursor: 'grab',
    zIndex: 2,
    '&:hover': {
      opacity: 1,
    }
  },
  currentUserVotePlaceholder: {
    top: -(USER_IMAGE_SIZE/2) - 5,
  },
  currentUserVoteActive: {
    opacity: 1,
    '&:hover .ForumEventPoll-clearVote': {
      display: 'flex',
    }
  },
  voteTooltipHeading: {
    fontSize: 14,
    fontWeight: 700,
    lineHeight: '140%',
    marginBottom: 4,
  },
  voteTooltipBody: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: '140%',
  },
  userImage: {
    outline: `2px solid ${theme.palette.text.alwaysWhite}`,
  },
  placeholderUserIcon: {
    // add a black background to the placeholder user circle icon
    background: 'radial-gradient(black 50%, transparent 50%)',
    color: theme.palette.text.alwaysWhite,
    fontSize: 34,
    borderRadius: '50%',
  },
  clearVote: {
    display: 'none',
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: `color-mix(in oklab, ${theme.palette.text.alwaysBlack} 65%, ${theme.palette.text.alwaysWhite} 35%)`,
    padding: 2,
    borderRadius: '50%',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.text.alwaysBlack,
    }
  },
  clearVoteIcon: {
    fontSize: 10,
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 'normal',
    marginTop: 22,
  },
  viewResultsButton: {
    background: 'none',
    fontFamily: theme.palette.fonts.sansSerifStack,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 'normal',
    color: theme.palette.text.alwaysWhite,
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    padding: 0,
    '&:hover': {
      opacity: 0.7
    }
  },
});

const addVoteQuery = gql`
  mutation AddForumEventVote($forumEventId: String!, $x: Int!, $delta: Int!, $postIds: [String]) {
    AddForumEventVote(forumEventId: $forumEventId, x: $x, delta: $delta, postIds: $postIds)
  }
`;
const removeVoteQuery = gql`
  mutation RemoveForumEventVote($forumEventId: String!) {
    RemoveForumEventVote(forumEventId: $forumEventId)
  }
`;

// The default vote position is in the middle of the slider
const defaultVotePos = (SLIDER_WIDTH/2) - (USER_IMAGE_SIZE/2)

export const ForumEventPoll = ({event, postId, classes}: {
  event: ForumEventsDisplay,
  postId?: string,
  classes: ClassesType<typeof styles>,
}) => {
  const {openDialog} = useDialog()
  const currentUser = useCurrentUser()
  // Pull the current user's vote position to initialize the component
  const currentUserVotePos: number|null = currentUser ? (event.publicData?.[currentUser._id]?.x ?? null) : null

  const [hasVoted, setHasVoted] = useState(currentUserVotePos !== null)
  const [isDragging, setIsDragging] = useState(false)
  const [votePos, setVotePos] = useState<number>(currentUserVotePos ?? defaultVotePos)
  const [currentUserVote, setCurrentUserVote] = useState<number|null>(currentUserVotePos)
  const [resultsVisible, setResultsVisible] = useState(currentUserVotePos !== null)
  
  const { results } = useMulti({
    terms: {
      view: 'usersByUserIds',
      userIds: event.publicData ? Object.keys(event.publicData).filter(userId => userId !== currentUser?._id) : []
    },
    collectionName: "Users",
    fragmentName: 'UserOnboardingAuthor',
    enableTotal: false,
    skip: !event.publicData,
  })
  
  const [addVote] = useMutation(
    addVoteQuery,
    {errorPolicy: "all"},
  )
  const [removeVote] = useMutation(
    removeVoteQuery,
    {errorPolicy: "all"},
  )
  
  const clearVote = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    setHasVoted(false)
    setVotePos(defaultVotePos)
    setCurrentUserVote(null)
    if (currentUser) void removeVote({variables: {forumEventId: event._id}})
  }, [setVotePos, setCurrentUserVote, currentUser, removeVote, event._id])
  
  const updateVotePos = useCallback((e: MouseEvent) => {
    if (isDragging) {
      console.log('e.movementX', e.movementX)
      // TODO: pause when mouse is too far right or left, and prob use percent
      setVotePos((val) => Math.min(Math.max(val + e.movementX, 0), SLIDER_WIDTH - (USER_IMAGE_SIZE/2)))
      setHasVoted(true)
    }
  }, [isDragging, setVotePos])
  const saveVotePos = useCallback(() => {
    console.log('mouseup')
    setIsDragging(false)
    // TODO: add modal
    if (hasVoted) {
      if (currentUser) {
        const delta = votePos - (currentUserVote ?? defaultVotePos)
        if (delta) {
          void addVote({variables: {
            forumEventId: event._id,
            x: votePos,
            delta,
            postIds: postId ? [postId] : ['a', 'b']
          }})
          setCurrentUserVote(votePos)
        }
      } else {
        openDialog({componentName: "LoginPopup"})
        clearVote()
      }
    }
  }, [setIsDragging, hasVoted, currentUser, addVote, event._id, votePos, currentUserVote, postId, setCurrentUserVote, openDialog, clearVote])
  useEventListener("mousemove", updateVotePos)
  useEventListener("mouseup", saveVotePos)

  const {ForumIcon, LWTooltip, UsersProfileImage} = Components;

  // TODO: put this somewhere
  const pollQuestion = <div className={classes.question}>
    “AI welfare
    <LWTooltip
      title="By “AI welfare”, we mean the potential wellbeing (pain, pleasure, but also frustration, satisfaction etc...) of future artificial intelligence systems."
    >
      <span className={classes.questionFootnote} style={{color: event.contrastColor ?? event.darkColor}}>1</span>
    </LWTooltip>{" "}
    should be an EA priority
    <LWTooltip
      title="By “EA priority” we mean that 5% of (unrestricted, i.e. open to EA-style cause prioritisation) talent and 5% of (unrestricted, i.e. open to EA-style cause prioritisation) funding should be allocated to this cause."
    >
      <span className={classes.questionFootnote} style={{color: event.contrastColor ?? event.darkColor}}>2</span>
    </LWTooltip>”
  </div>

  return (
    <div className={classes.root}>
      {pollQuestion}
      <div className={classes.sliderRow}>
        <ForumIcon icon="ChevronLeft" className={classNames(classes.sliderArrow, classes.sliderArrowLeft)} />
        <div>
          <div className={classes.sliderLine}>
            {resultsVisible && results && results.map(user => {
              const vote = event.publicData[user._id]
              return <div key={user._id} className={classes.userVote} style={{left: `${vote.x}px`}}>
                <LWTooltip title={<div className={classes.voteTooltipBody}>{user.displayName}</div>}>
                  <UsersProfileImage user={user} size={USER_IMAGE_SIZE} className={classes.userImage} />
                </LWTooltip>
              </div>
            })}
            <div
              className={classNames(
                classes.userVote,
                classes.currentUserVote,
                !currentUser && classes.currentUserVotePlaceholder,
                currentUserVote && classes.currentUserVoteActive
              )}
              onMouseDown={() => setIsDragging(true)}
              style={{left: `${votePos}px`}}
            >
              <LWTooltip title={currentUserVote ? <div className={classes.voteTooltipBody}>Drag to move</div> : <>
                  <div className={classes.voteTooltipHeading}>Press and drag to vote</div>
                  <div className={classes.voteTooltipBody}>Votes are non-anonymous and can be changed at any time</div>
                </>}
              >
                {currentUser ?
                  <UsersProfileImage user={currentUser} size={USER_IMAGE_SIZE} className={classes.userImage} /> :
                  <ForumIcon icon="UserCircle" className={classes.placeholderUserIcon} />
                }
                <div className={classes.clearVote} onClick={clearVote}>
                  <ForumIcon icon="Close" className={classes.clearVoteIcon} />
                </div>
              </LWTooltip>
            </div>
          </div>
          <div className={classes.sliderLabels}>
            <div>Disagree</div>
            {/* TODO: prob hide this when there are no votes? */}
            <ForumNoSSR>
              {!hasVoted && !resultsVisible && <div>
                {event.voteCount} vote{event.voteCount === 1 ? '' : 's'} so far.
                Place your vote or <button className={classes.viewResultsButton} onClick={() => setResultsVisible(true)}>view results</button>
              </div>}
            </ForumNoSSR>
            <div>Agree</div>
          </div>
        </div>
        <ForumIcon icon="ChevronRight" className={classNames(classes.sliderArrow, classes.sliderArrowRight)} />
      </div>
    </div>
  );
}

const ForumEventPollComponent = registerComponent(
  "ForumEventPoll",
  ForumEventPoll,
  {styles},
);

declare global {
  interface ComponentTypes {
    ForumEventPoll: typeof ForumEventPollComponent
  }
}
