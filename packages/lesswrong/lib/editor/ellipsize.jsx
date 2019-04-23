import truncatise from 'truncatise';

const highlightMaxChars = 2400;
export const defaultCommentMaxLength = 2400
export const excerptMaxChars = 700;
export const postExcerptMaxChars = 600;

export const highlightFromMarkdown = (body, mdi) => {
  const html = mdi.render(body);
  return highlightFromHTML(html);
}

export const highlightFromHTML = (html) => {
  return truncatise(html, {
    TruncateLength: highlightMaxChars,
    TruncateBy: "characters",
    Suffix: "...",
  });
};

export const truncate = (html, truncateLength) => {
  return truncatise(html, {
    TruncateLength: Math.floor(truncateLength - (truncateLength/4)) || truncateLength,
    TruncateBy: "characters",
    Suffix: "...",
  });
}

export const postExcerptFromHTML = (html, truncationCharCount) => {
  if(!html) return ""
  const styles = html.match(/<style[\s\S]*?<\/style>/g) || ""
  const htmlRemovedStyles = html.replace(/<style[\s\S]*?<\/style>/g, '');

  return truncatise(htmlRemovedStyles, {
    TruncateLength: truncationCharCount || postExcerptMaxChars,
    TruncateBy: "characters",
    Suffix: `... <a class="read-more-default">(Read more)</a>${styles}`,
  });
};

export const getTruncationCharCount = (postPage, comment, currentUser) => {
  
  // Do not truncate for users who have disabled it in their user settings. Might want to do someting more elegant here someday.
  if (currentUser && currentUser.noCollapseCommentsPosts && postPage) {
    return 10000000
  }
  if (currentUser && currentUser.noCollapseCommentsFrontpage && !postPage) {
    return 10000000
  }
  const commentIsByGPT2 = !!(comment && comment.user && comment.user.displayName === "GPT2")
  if (commentIsByGPT2) return 400

  const commentIsRecent = comment.postedAt > new Date(new Date().getTime()-(2*24*60*60*1000)); // past 2 days
  const commentIsHighKarma = comment.baseScore >= 10
  
  if (postPage) {
    return (commentIsRecent || commentIsHighKarma) ? 1600 : 800
  } else {
    return 700
  }
  if (!postPage) {
    return 700
  }
  return 2400 
}

export const commentExcerptFromHTML = (comment, truncationAmount, currentUser) => {
  if(!html) return ""
  const styles = html.match(/<style[\s\S]*?<\/style>/g) || ""
  const htmlRemovedStyles = html.replace(/<style[\s\S]*?<\/style>/g, '');

  const truncationCharCount = getTruncationCharCount(truncationAmount, karma)

  return truncatise(htmlRemovedStyles, {
    // We want the amount comments get truncated to to be less than the threshold at which they are truncated, so that users don't have the experience of expanding a comment only to see a couple more words (which just feels silly).

    // This varies by the size of the comment or truncation amount, and reducing it by 1/4th seems about right.
    TruncateLength: Math.floor(truncationCharCount - (truncationCharCount/4)),
    TruncateBy: "characters",
    Suffix: `... <span class="read-more"><a class="read-more-default">(Read more)</a><a class="read-more-tooltip">(Click to expand thread)</a><span class="read-more-f-tooltip">Cmd/Ctrl F to expand all comments on this post</span></span>${styles}`,
  });
};

export const excerptFromMarkdown = (body, mdi) => {
  const html = mdi.render(body);
  return commentExcerptFromHTML(html);
}
