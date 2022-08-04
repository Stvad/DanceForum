import { Components, registerComponent } from '../../lib/vulcan-lib';
import React from 'react';
import { Link } from '../../lib/reactRouterWrapper';
import { postGetPageUrl } from '../../lib/collections/posts/helpers';
import classNames from 'classnames';
import { useItemsRead } from '../common/withRecordPostView';

const styles = (theme: ThemeType): JssStyles => ({
  root: {
    display: "inline"
  },
  postProgressBox: {
    border: theme.palette.border.normal,
    borderRadius: 2,
    width: 12,
    height: 12,
    marginRight: 1,
    marginTop: 2,
  },
  read: {
    backgroundColor: theme.palette.primary.light,
    border: theme.palette.primary.main,
    opacity: .6
  },
  bookProgress: {
    display: "flex",
    flexWrap: "wrap",
  },
  progressText: {
    marginTop: 12,
    ...theme.typography.commentStyle,
    color: theme.palette.grey[500],
    fontSize: "1rem",
  },
  loginText: {
    color: theme.palette.primary.main,
    marginLeft: 12,
    fontSize: "1rem"
  }
});

const BooksProgressBar = ({ book, classes }: {
  book: BookPageFragment,
  classes: ClassesType
}) => {
  const { LWTooltip, PostsPreviewTooltip, LoginPopupButton } = Components;

  const { postsRead: clientPostsRead } = useItemsRead();

  const bookPosts = book.sequences.flatMap(sequence => sequence.chapters.flatMap(chapter => chapter.posts));
  // Check whether the post is marked as read either on the server or in the client-side context
  const readPosts = bookPosts.filter(post => post.isRead || clientPostsRead[post._id]).length;
  const totalPosts = bookPosts.length;

  const postsReadText = `${readPosts} / ${totalPosts} posts read`;

  if (book.hideProgressBar) return null

  return <div key={book._id} className={classes.root}>
    <div className={classes.bookProgress}>
      {
        bookPosts.map(post => (
          <LWTooltip key={post._id} title={<PostsPreviewTooltip post={post}/>} tooltip={false} flip={false}>
            <Link to={postGetPageUrl(post)}>
              <div className={classNames(classes.postProgressBox, {[classes.read]: post.isRead || clientPostsRead[post._id]})} />
            </Link>
          </LWTooltip>
          ))
      }
    </div>
    <div className={classNames(classes.sequence, classes.progressText)}>
      {postsReadText} 
      <LoginPopupButton title="LessWrong keeps track of what posts logged in users have read, so you can keep reading wherever you've left off" className={classes.loginText}>
        login to track progress
      </LoginPopupButton>
    </div>
  </div>;
};

const BooksProgressBarComponent = registerComponent('BooksProgressBar', BooksProgressBar, { styles });

declare global {
  interface ComponentTypes {
    BooksProgressBar: typeof BooksProgressBarComponent
  }
}

