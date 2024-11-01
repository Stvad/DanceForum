import React from 'react'
import {combineUrls, Components, getSiteUrl, registerComponent} from '../../lib/vulcan-lib'
import {useCurrentUser} from '../common/withUser'
import {AnalyticsContext} from '../../lib/analyticsEvents'
import DeferRender from '../common/DeferRender'
import {PostsListViewProvider} from '../hooks/usePostsListView'


const getStructuredData = () => ({
  '@context': 'http://schema.org',
  '@type': 'WebSite',
  'url': `${getSiteUrl()}`,
  'potentialAction': {
    '@type': 'SearchAction',
    'target': `${combineUrls(getSiteUrl(), '/search')}?query={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
  'mainEntityOfPage': {
    '@type': 'WebPage',
    '@id': `${getSiteUrl()}`,
  },
  'description': [
    'A forum for discussions about West Coast Swing (Modern Swing).',
    'A place to share and develop your understanding of the dance,',
    'find WCS events near you, and connect with other dancers.',
    'A Wiki covering WCS concepts and techniques, tips for dance conventions and other WCS related topics.',
  ].join(' '),
})

const styles = (_theme: ThemeType) => ({
  spotlightMargin: {
    marginBottom: 24,
  },
})

const FrontpageNode = ({classes}: { classes: ClassesType<typeof styles> }) => {
  const currentUser = useCurrentUser()
  const {
    RecentDiscussionFeed, QuickTakesSection, DismissibleSpotlightItem,
    HomeLatestPosts, EAPopularCommentsSection,
  } = Components
  return (
    <>
      <DismissibleSpotlightItem current className={classes.spotlightMargin}/>
      <HomeLatestPosts/>
      <QuickTakesSection/>
      {/*<DeferRender ssr={!!currentUser} clientTiming="mobile-aware">*/}
      {/*  todo: re-enable later when we have popular comments*/}
        {/*<EAPopularCommentsSection />*/}
      {/*</DeferRender>*/}
      <DeferRender ssr={!!currentUser} clientTiming="async-non-blocking">
        <RecentDiscussionFeed
          title="Recent discussion"
          af={false}
          commentsLimit={4}
          maxAgeHours={18}
        />
      </DeferRender>
    </>
  )
}

const DFHome = ({classes}: { classes: ClassesType<typeof styles> }) => {
  //todo maintenance banner is a good thing to steal

  const {
    HeadTags,
  } = Components
  return (
    <AnalyticsContext pageContext="homePage">
      <HeadTags structuredData={getStructuredData()}/>

      <PostsListViewProvider>
        <FrontpageNode classes={classes}/>
      </PostsListViewProvider>
      {/*todo: re-enable later when we have some posts under tags */}
      {/*<EAHomeMainContent FrontpageNode={FrontpageNodeWithClasses} />*/}
    </AnalyticsContext>
  )
}

const DFHomeComponent = registerComponent('DFHome', DFHome, {styles})

declare global {
  interface ComponentTypes {
    DFHome: typeof DFHomeComponent
  }
}
