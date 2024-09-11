import { AnnualReviewMarketInfo } from '../../lib/annualReviewMarkets';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import React from 'react';
import { useHover } from '../common/withHover';
import { highlightReviewWinnerThresholdSetting } from '@/lib/instanceSettings';
import { tagStyle } from '../tagging/FooterTag';
import { isFriendlyUI } from '@/themes/forumTheme';
import Card from '@material-ui/core/Card';
import { FRIENDLY_HOVER_OVER_WIDTH } from '../common/FriendlyHoverOver';

const styles = (theme: ThemeType) => ({
  expectedWinner: {
    color: theme.palette.review.winner,
    border: '1px solid',
    borderColor: theme.palette.review.winner,
    borderRadius: '4px',
    fontFamily: theme.typography.fontFamily,
    width: 'fit-content',
    display: 'inline-block',
    padding: '5px',
    boxSizing: 'border-box',

    paddingLeft: 6,
    paddingRight: 6,
    marginRight: isFriendlyUI ? 3 : undefined,
    marginBottom: isFriendlyUI ? 8 : undefined,
    fontWeight: theme.typography.body1.fontWeight,
    ...theme.typography.commentStyle,
    cursor: "pointer",
    whiteSpace: isFriendlyUI ? "nowrap": undefined,
  },
  expectedLoser: {
    color: theme.palette.tag.text,
    fontFamily: theme.typography.fontFamily,
    width: 'fit-content',
    display: 'inline-block',
    padding: '5px',
    
    paddingLeft: 6,
    paddingRight: 6,
    marginRight: isFriendlyUI ? 3 : undefined,
    marginBottom: isFriendlyUI ? 8 : undefined,
    fontWeight: theme.typography.body1.fontWeight,
    ...theme.typography.commentStyle,
    cursor: "pointer",
    whiteSpace: isFriendlyUI ? "nowrap": undefined,
  },
  preview: {
    maxWidth: 400,
  },
  card: {
    padding: 16,
    ...(isFriendlyUI
      ? {
        paddingTop: 12,
        width: FRIENDLY_HOVER_OVER_WIDTH,
      }
      : {
        width: 450,
        paddingTop: 8,
      }),
  },
});

const PostsAnnualReviewMarketTag = ({ post, annualReviewMarketInfo, classes }: {
  post: PostsWithNavigation | PostsWithNavigationAndRevision | PostsList | SunshinePostsList,
  annualReviewMarketInfo: AnnualReviewMarketInfo,
  classes: ClassesType<typeof styles>,
}) => {

  const { HoverOver, ContentStyles, ContentItemBody } = Components;
  const { anchorEl, hover, eventHandlers } = useHover();

  const { annualReviewMarketComment } = post;

  const year = annualReviewMarketInfo.year
  // const marketUrl = post.manifoldReviewMarketUrl
  const marketUrl = 'https://manifold.markets/LessWrong/will-transformers-represent-belief'

  const golden = (annualReviewMarketInfo.probability >= highlightReviewWinnerThresholdSetting.get()) ? "expectedWinner" : "expectedLoser"
  const tooltipBody = `<p>The <a href="https://www.lesswrong.com/bestoflesswrong">LessWrong Review</a> runs every year to select the posts that have most stood the test of time. This post is not yet eligible for review, but will be at the end of ${year+1}. The top fifty or so posts are featured prominently on the site throughout the year.</p><p>Hopefully, the review is better than karma at judging enduring value. If we have accurate prediction markets on the review results, maybe we can have better incentives on LessWrong today. <a href="${marketUrl}">Will this post make the top fifty?</a></p>
  `

  const decimalPlaces = 0;
  return <span>
    <div className={classes[golden]} {...eventHandlers}>
      {<HoverOver
          title={
            <Card className={classes.card}>
              <ContentStyles contentType="comment">
                <ContentItemBody dangerouslySetInnerHTML={{ __html: tooltipBody }} />
              </ContentStyles>
            </Card>
          }
          tooltip={false}
          clickable={true}
        >
        <div className={classes.preview}>
          {annualReviewMarketInfo.year} Top Fifty: {parseFloat((annualReviewMarketInfo.probability * 100).toFixed(decimalPlaces))}%
        </div>
      </HoverOver>
      }
    </div>
  </span>
};

const PostsAnnualReviewMarketTagComponent = registerComponent('PostsAnnualReviewMarketTag', PostsAnnualReviewMarketTag, { styles });

declare global {
  interface ComponentTypes {
    PostsAnnualReviewMarketTag: typeof PostsAnnualReviewMarketTagComponent
  }
}
