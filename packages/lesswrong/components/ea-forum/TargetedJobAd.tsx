import React, { useCallback, useState } from 'react';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import Button from '@material-ui/core/Button'
import CloseIcon from '@material-ui/icons/Close'
import { AnalyticsContext } from '../../lib/analyticsEvents';
import Tooltip from '@material-ui/core/Tooltip';
import classNames from 'classnames';
import OpenInNew from '@material-ui/icons/OpenInNew';
import moment from 'moment';
import { Link } from '../../lib/reactRouterWrapper';
import { CareerStageValue } from '../../lib/collections/users/schema';

const styles = (theme: ThemeType): JssStyles => ({
  root: {
    maxHeight: 1200, // This is to make the close transition work
    background: theme.palette.grey[0],
    fontFamily: theme.typography.fontFamily,
    padding: '10px 12px 12px',
    border: `1px solid ${theme.palette.grey[100]}`,
    borderRadius: theme.borderRadius.default,
    [theme.breakpoints.down('xs')]: {
      columnGap: 12,
      padding: '6px 10px',
    }
  },
  rootClosed: {
    opacity: 0,
    visibility: 'hidden',
    paddingTop: 0,
    paddingBottom: 0,
    maxHeight: 0,
    transitionProperty: 'opacity, visibility, padding-top, padding-bottom, max-height',
    transitionDuration: '0.5s',
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 10,
    marginBottom: 5,
  },
  infoIcon: {
    fontSize: 14,
    color: theme.palette.grey[400],
    transform: 'translateY(2px)'
  },
  closeButton: {
    padding: '.25em',
    minHeight: '.75em',
    minWidth: '.75em',
  },
  closeIcon: {
    fontSize: 16,
    color: theme.palette.grey[500],
  },
  mainRow: {
    display: 'flex',
    alignItems: 'flex-start',
    columnGap: 8,
  },
  logo: {
    flex: 'none',
    width: 36,
    borderRadius: theme.borderRadius.small,
    marginTop: 5,
  },
  bodyCol: {
    flexGrow: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 20,
    rowGap: '10px',
    flexWrap: 'wrap',
  },
  headerRow: {
    marginBottom: 4
  },
  pinIcon: {
    verticalAlign: 'sub',
    width: 16,
    height: 16,
    color: theme.palette.primary.main,
    padding: 1.5,
    marginRight: 8,
  },
  header: {
    display: 'inline',
    fontSize: 16,
    lineHeight: '22px',
    fontWeight: 600,
    color: theme.palette.grey[1000],
    margin: '0 0 4px'
  },
  metadataRow: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: '3px',
    color: theme.palette.grey[600],
  },
  metadata: {
    display: 'flex',
    alignItems: 'center',
    columnGap: 3,
    fontSize: 13,
    lineHeight: '17px',
    color: theme.palette.grey[600],
    fontWeight: 500,
  },
  metadataIcon: {
    fontSize: 12,
  },
  feedbackLink: {
    flexGrow: 1,
    [theme.breakpoints.down('xs')]: {
      display: 'none'
    }
  },
  reminderBtn: {
    background: 'none',
    fontSize: 13,
    lineHeight: '17px',
    color: theme.palette.grey[600],
    fontWeight: 500,
    fontFamily: theme.typography.fontFamily,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    padding: 0,
    '&:hover': {
      color: theme.palette.grey[800],
    },
  },
  applyBtn: {
    marginRight: 5,
    marginBottom: 4,
  },
  btnIcon: {
    fontSize: 16,
    marginLeft: 6
  },
})

// list of "interested in" / "experienced in" / "working in" options from EAG
type EAGOccupationOrCause =
  'Academic research'|
  'AI safety technical research'|
  'AI strategy & policy'|
  'Alternative proteins'|
  'Biosecurity'|
  'China-Western relations'|
  'Civilisational recovery/resilience'|
  'Climate change mitigation'|
  'Communications/Marketing'|
  'Consulting'|
  'Counselling/Social work'|
  'Creatives'|  // This might be a stray value, only one person had this
  'Data science/Data visualization'|
  'EA community building/community management'|
  'Earning to give'|
  'Education'|
  'Entrepreneurship'|
  'Event production'|
  'Farmed animal welfare'|
  'Finance/Accounting'|
  'General X-Risk'|
  'Global coordination & peace-building'|
  'Global health & development'|
  'Global mental health & well-being'|
  'Global priorities research'|
  'Grantmaking'|
  'Graphic design'|
  'Healthcare/Medicine'|
  'HR/People operations'|
  'Improving institutional decision making'|
  'Information security'|
  'Journalism'|
  'Machine learning'|
  'Nuclear security'|
  'Operations'|
  'People management'|
  'Philanthropy'|
  'Policymaking/Civil service'|
  'Politics'|
  'Product management'|
  'Project management/ Program management'|
  'Software development/Software engineering'|
  'Space governance'|
  'S-risks'|
  'Technology'|
  'User experience design/research'|
  'Wild animal welfare'|
  'Writing'

type EAGWillingToMoveOptions =
  'I’d be excited to move here or already live here'|
  'I’d be willing to move here for a good opportunity'|
  'I’m hesitant to move here, but would for a great opportunity'|
  'I’m unwilling or unable to move here'

type JobAdData = {
  careerStages?: CareerStageValue[],            // used to match on career stages (either from the user profile or EAG)
  experiencedIn?: EAGOccupationOrCause[],       // used to match on EAG experience
  interestedIn?: EAGOccupationOrCause[],        // used to match on EAG interests
  subscribedTagIds?: string[],                  // used to match on a set of topics that the user is subscribed to
  readCoreTagIds?: string[],                    // used to match on a set of core topics that the user has read frequently
  coreTagReadsThreshold?: number,               // used to adjust the threshold for how many post reads per topic to qualify for seeing the ad
  logo: string,                                 // url for org logo
  occupation: string,                           // text displayed in the tooltip
  feedbackLinkPrefill: string,                  // url param used to prefill part of the feedback form
  bitlyLink: string,                            // bitly link to the job ad page
  role: string,
  insertThe?: boolean,                          // set if you want to insert a "the" before the org name
  org: string,
  orgLink: string,                              // internal link on the org name
  salary?: string,
  location: string,
  countryCode?: string,                         // if provided, only show to users who we think are in this country (match on account location)
  countryName?: string,                         // if provided, only show to users who we think are in this country (match on EAG data)
  roleType?: string,                            // i.e. part-time, contract
  deadline?: moment.Moment,                     // also used to hide the ad after this date
}

// job-specific data for the ad
// (also used in the reminder email, so links in the description need to be absolute)
export const JOB_AD_DATA: Record<string, JobAdData> = {
  'iaps-ai-policy-fellowship': {
    careerStages: ['earlyCareer'],
    interestedIn: ['AI strategy & policy'],
    subscribedTagIds: [
      'u3Xg8MjDe2e6BvKtv' // AI governance
    ],
    logo: 'https://80000hours.org/wp-content/uploads/2023/10/institute_for_ai_policy_and_strategy_iaps_logo-160x160.jpeg',
    occupation: 'AI policy',
    feedbackLinkPrefill: 'AI+Policy+Fellow+at+IAPS',
    bitlyLink: "https://efctv.org/49Jfdx5", // https://www.iaps.ai/fellowship
    role: 'AI Policy Fellow',
    insertThe: true,
    org: 'Institute for AI Policy & Strategy',
    orgLink: '/topics/institute-for-ai-policy-and-strategy',
    salary: '$5k per month',
    location: 'Remote',
    deadline: moment('2024-03-18'),
  },
  'cea-head-of-comms': {
    careerStages: ['midCareer', 'lateCareer'],
    experiencedIn: ['Communications/Marketing', 'Journalism'],
    logo: 'https://80000hours.org/wp-content/uploads/2022/12/CEA-160x160.png',
    occupation: 'communications',
    feedbackLinkPrefill: 'Head+of+Communications+at+CEA',
    bitlyLink: "https://efctv.org/3P5ISZ7", // https://www.centreforeffectivealtruism.org/careers/head-of-communications
    role: 'Head of Communications',
    insertThe: true,
    org: 'Centre for Effective Altruism',
    orgLink: '/topics/centre-for-effective-altruism-1',
    salary: '$97k - $170k',
    location: 'Remote',
    deadline: moment('2024-03-22'),
  },
  'fem-head-of-ops': {
    careerStages: ['midCareer', 'lateCareer'],
    experiencedIn: ['Operations'],
    interestedIn: ['Global health & development'],
    subscribedTagIds: [
      'sWcuTyTB5dP3nas2t', // GH&D
    ],
    logo: 'https://80000hours.org/wp-content/uploads/2022/05/Family-Empowerment-Media-160x160.png',
    occupation: 'ops and global health & development',
    feedbackLinkPrefill: 'Head+of+Operations+at+FEM',
    bitlyLink: "https://efctv.org/4c50Kxd", // https://docs.google.com/document/d/1Crui7aF5tEU-EYpC5dJ-fCTzXenmR85x9CFb3k3H8wo/edit
    role: 'Head of Operations',
    org: 'Family Empowerment Media',
    orgLink: '/topics/family-empowerment-media',
    salary: '$50k - $65k',
    location: 'Remote',
    deadline: moment('2024-03-31'),
  },
}

/**
 * This component only handles the job ad UI. See TargetedJobAdSection.tsx for functional logic.
 */
const TargetedJobAd = ({ad, onDismiss, onApply, onRemindMe, classes}: {
  ad: string,
  onDismiss: () => void,
  onApply: () => void,
  onRemindMe: () => void,
  classes: ClassesType<typeof styles>,
}) => {
  const adData = JOB_AD_DATA[ad]
  
  // clicking either "apply" or "remind me" will close the ad
  const [closed, setClosed] = useState(false)
  
  const handleApply = useCallback(() => {
    setClosed(true)
    onApply()
  }, [setClosed, onApply])
  
  const handleRemindMe = useCallback(() => {
    setClosed(true)
    onRemindMe()
  }, [setClosed, onRemindMe])
  
  const { HoverPreviewLink, LWTooltip, ForumIcon, EAButton } = Components
  
  if (!adData) {
    return null
  }
  
  // Only show the "Remind me" button if the job's deadline is more than 3 days away
  const showRemindMe = adData.deadline && moment().add(3, 'days').isBefore(adData.deadline)
  
  return <AnalyticsContext pageSubSectionContext="targetedJobAd">
    <div className={classNames(classes.root, {[classes.rootClosed]: closed})}>

      <div className={classes.topRow}>
        <div className={classNames(classes.jobRecLabel, classes.metadata)}>
          Job recommendation for you
          <LWTooltip title={
            `You're seeing this recommendation because of your interest in ${adData.occupation}.`
          }>
            <ForumIcon icon="InfoCircle" className={classes.infoIcon} />
          </LWTooltip>
        </div>
        <div className={classNames(classes.feedbackLink, classes.metadata)}>
          <a href={`
              https://docs.google.com/forms/d/e/1FAIpQLSd4uDGbXbJSwYX2w_9wXNTuLLBf7bhiWoWc-goJJXiWGA7qDg/viewform?usp=pp_url&entry.70861771=${adData.feedbackLinkPrefill}
            `}
            target="_blank"
            rel="noopener noreferrer"
          >
            Give us feedback
          </a>
        </div>
        <Tooltip title="Dismiss">
          <Button className={classes.closeButton} onClick={onDismiss}>
            <CloseIcon className={classes.closeIcon} />
          </Button>
        </Tooltip>
      </div>

      <div className={classes.mainRow}>
        <img src={adData.logo} className={classes.logo} />
        <div className={classes.bodyCol}>
          
          <div>
            <div className={classes.headerRow}>
              <ForumIcon icon="Pin" className={classes.pinIcon} />
              <h2 className={classes.header}>
                <Link to={adData.bitlyLink} target="_blank" rel="noopener noreferrer">
                  {adData.role}
                </Link> at{adData.insertThe ? ' the ' : ' '}
                <HoverPreviewLink href={adData.orgLink}>
                  {adData.org}
                </HoverPreviewLink>
              </h2>
            </div>
            <div className={classes.metadataRow}>
              {adData.salary && <>
                <div className={classes.metadata}>
                  {adData.salary}
                </div>
                <div>·</div>
              </>}
              <div className={classes.metadata}>
                {adData.location}
              </div>
              {adData.roleType && <>
                <div>·</div>
                <div className={classes.metadata}>
                  {adData.roleType}
                </div>
              </>}
              {adData.deadline && <>
                <div>·</div>
                <div className={classes.metadata}>
                  Deadline: {adData.deadline.format('MMM Do')}
                </div>
                {showRemindMe && <>
                  <div>·</div>
                  <button onClick={handleRemindMe} className={classes.reminderBtn}>
                    Remind me
                  </button>
                </>}
              </>}
            </div>
          </div>
          
          <EAButton
            style="grey"
            variant="contained"
            href={adData.bitlyLink}
            target="_blank"
            rel="noopener noreferrer"
            className={classes.applyBtn}
            onClick={() => handleApply()}
          >
            View job details <OpenInNew className={classes.btnIcon} />
          </EAButton>
        </div>
      </div>
    </div>
  </AnalyticsContext>
}

const TargetedJobAdComponent = registerComponent("TargetedJobAd", TargetedJobAd, {styles});

declare global {
  interface ComponentTypes {
    TargetedJobAd: typeof TargetedJobAdComponent
  }
}
