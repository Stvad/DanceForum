import { userGetDisplayName } from "@/lib/collections/users/helpers"
import { htmlToMarkdown } from "../editor/conversionUtils";
import { CommentTreeNode, unflattenComments } from "@/lib/utils/unflatten";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

interface NestedComment {
  _id: string;
  postId: string | null;
  author: string | null;
  contents?: string;
  karmaScore: number;
}

interface TokenCounter {
  tokenCount: number;
}

interface RecommendationContextData {
  homeLatestPosts: PostsPage[];
  userUpvotedPosts: PostsPage[];
}

// Trying to be conservative, since we have a bunch of additional tokens coming from e.g. JSON.stringify
const CHARS_PER_TOKEN = 3.5;

export const documentToMarkdown = (document: PostsPage | DbComment | null) => {
  const html = document?.contents?.html;
  if (!html) {
    return undefined;
  }

  return htmlToMarkdown(html);
}

const mergeSortedArrays = (queue: CommentTreeNode<NestedComment>[], children: CommentTreeNode<NestedComment>[]): CommentTreeNode<NestedComment>[] => {
  const merged: CommentTreeNode<NestedComment>[] = [];
  let queueIdx = 0, childrenIdx = 0;

  while (queueIdx < queue.length && childrenIdx < children.length) {
    if (queue[queueIdx].item.karmaScore >= children[childrenIdx].item.karmaScore) {
      merged.push(queue[queueIdx]);
      queueIdx++;
    } else {
      merged.push(children[childrenIdx]);
      childrenIdx++;
    }
  }

  // Add any remaining elements
  return merged
    .concat(queue.slice(queueIdx))
    .concat(children.slice(childrenIdx));
}

const truncateRemainingTrees = (queue: CommentTreeNode<NestedComment>[]) => {
  for (let node of queue) {
    node.children = [];
  }
}

/**
 * Does a greedy karma-sorted breadth-first traversal over all the comment branches, and truncates them at the point where we estimate that we hit the token limit
 * i.e. we take the highest karma comment from all the queue, increment token count, put its children into the queue, resort, do the operation again
 * This means that we never have any gaps in comment branches.
 * It does pessimize against comments that are children of lower-karma comments, but doing lookahead is annoying and that shouldn't be a problem most of the time.
 * It might turn out that we want to prioritize full comment branches, in which case this will need to be replaced with a depth-first thing.
 */
const filterCommentTrees = (trees: CommentTreeNode<NestedComment>[], tokenCounter: TokenCounter) => {
  const tokenThreshold = 150_000;
  
  // Initialize the queue with root nodes, sorted by karma
  let queue: CommentTreeNode<NestedComment>[] = trees.sort((a, b) => b.item.karmaScore - a.item.karmaScore);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const nodeTokens = (node.item.contents ?? '').length / CHARS_PER_TOKEN;

    if (tokenCounter.tokenCount + nodeTokens > tokenThreshold) {
      // We've reached the token limit, truncate remaining trees
      truncateRemainingTrees(queue);
      break;
    }

    tokenCounter.tokenCount += nodeTokens;

    // Sort children and merge them with the existing sorted queue
    if (node.children.length > 0) {
      const sortedChildren = node.children.sort((a, b) => b.item.karmaScore - a.item.karmaScore);
      queue = mergeSortedArrays(queue, sortedChildren);
    }
  }
}

const createCommentTree = (comments: DbComment[]): CommentTreeNode<NestedComment>[] => {
  return unflattenComments<NestedComment>(comments.map(comment => {
    const { baseScore, contents, ...rest } = comment;
    return {
      ...rest,
      karmaScore: baseScore,
      contents: documentToMarkdown(comment)
    };
  }));
}

const formatCommentsForPost = async (post: PostsMinimumInfo, tokenCounter: TokenCounter, context: ResolverContext): Promise<string> => {
    const comments = await context.Comments.find({postId: post._id}).fetch()
    if (!comments.length) {
      return ""
    }

    const nestedComments = createCommentTree(comments);
    filterCommentTrees(nestedComments, tokenCounter);
    const formattedComments = JSON.stringify(nestedComments);

    return `Comments for the post titled "${post.title}" with postId "${post._id}" are below.  Note that the comments are threaded (i.e. branching) and are formatted as a nested JSON structure for readability.  The threads of conversation (back and forth responses) might be relevant for answering some questions.

<comments>${formattedComments}</comments>`;
  }

const formatPostForPrompt = (post: PostsPage, truncation?: number): string => {
  const authorName = userGetDisplayName(post.user)
  const markdown = documentToMarkdown(post)

  return `postId: ${post._id}
Title: ${post.title}
Author: ${authorName}
Publish Date: ${post.postedAt}
Score: ${post.baseScore}
Content: ${markdown?.slice(0, truncation)}`;
}

const formatAdditionalPostsForPrompt = (posts: PostsPage[], tokenCounter: TokenCounter, limit=120_000, prefix="Supplementary Post", truncation?: number): string => {
  const formattedPosts = posts.map(post => formatPostForPrompt(post, truncation ? Math.floor(truncation/CHARS_PER_TOKEN): undefined));
  const includedPosts: string[] = [];

  for (let [idx, formattedPost] of Object.entries(formattedPosts)) {
    const approximatePostTokenCount = formattedPost.length / CHARS_PER_TOKEN;
    const postInclusionTokenCount = tokenCounter.tokenCount + approximatePostTokenCount;
    // Include at least one additional post, unless that takes us over the higher threshold
    if (idx !== '0' && postInclusionTokenCount > limit) {
      break;
    }

    if (idx === '0' && postInclusionTokenCount > limit + 20_000) {
      break;
    }

    includedPosts.push(formattedPost);
    tokenCounter.tokenCount += approximatePostTokenCount;
  }

  return includedPosts.map((post, index) => `${prefix} #${index}:\n${post}`).join('\n')
}

export const generateLoadingMessagePrompt = (query: string, postTitle?: string): string => {
  return [
    'I need you to generate some humorous "loading messages" to display to users of the LessWrong.com Claude chat integration since it can take 10-30 seconds to load new responses',
    'Your responses may make general humorous reference to LessWrong, but it is even better if they are tailored to the specific query or post the user is viewing.',
    `The user has asked the following question: "${query}"`,
    postTitle ? `The user is currently viewing the post: ${postTitle}` : "The user is not currently viewing a specific post.",
    'Please generate 5 humorous loading messages that could be displayed to the user while they wait for a response.',
  ].join('\n')
}

export const generateTitleGenerationPrompt = (query: string, currentPost: PostsPage | null): string => {
  const currentPostContextLine = currentPost
    ? `The user is currently viewing a post titled "${currentPost.title}". Reference it if relevant.`
    : '';

    return `A user has started a new converation with you, Claude.  Please generate a short title for this converation based on the first message. The first message is as follows: <message>${query}</message>

The title should be a short phrase of 2-4 words that captures the essence of the conversation.  Do not wrap your answer in quotes or brackets. Do not include the word "title" or similar in your response.  ${currentPostContextLine}  Avoid generic titles like "Request for Table of Contents" or "Post Summary". Prefer to reference the specific post or topic being discussed.`;
}

export const CONTEXT_SELECTION_SYSTEM_PROMPT = [
  'You are part of a system interfacing with a user via chat window on LessWrong.com.',
  'Your responsibility is to make decisions about whether or not to load LessWrong posts as additional context for responding to user queries, and what strategy to to employ.'
].join('\n');

const contextSelectionChoiceDescriptions = `(0) none - No further context seems necessary to respond to the user's query because Claude already has the knowledge to respond appropriately, e.g. the user asked "What is Jacobian of a matrix?"or "Proofread the following text." Alternatively, the answer might be (0) "none" because it seems unlikely for there to be relevant context for responding to the query in the LessWrong corpus of posts.

(1) query-based - Load LessWrong posts based on their vector similarity to the user's query, and ignore the post the user is reading. This is correct choice if the query seems unrelated to the post the user is currently viewing, but it seems likely that there are LessWrong posts concerning the topic.(If it is a very general question, the correct choice might be (0) "none").

(2) current-post-only - Load the current LessWrong post into context but nothing else. This is the correct choice if the query seems to be about the post the user is currently viewing and further context is unnecesary. For example, if the user asks for a summary or explanation of the current post.

(3) current-post-and-search - Load the currently review LessWrong post and similar posts based on vector similarity to the post the user is reading (but posts based on vector similarity to the query). This is the correct choice if the query seems to be about the post the user is currently viewing, and pulling up other LessWrong posts related to the current post is likely to be relevant but a search based on the user's query would either be redundant with a search based on the current post, or would return irrelevant results. Some examples of such queries that should get current-post-and-search are: "What are some disagreements with the arguments in this post?", "Explain <topic in the post> to me."

(4) both - Load LessWrong posts based on their vector similarity to both the user's query and the post the user is reading. This is the correct choice if the question seems to be related to the post the user is currently viewing, but also contains keywords or information where relevant LessWrong posts would be beneficial context for a response, and those LessWrong posts would not likely be returned in a vector similarity search based on the post the user is currently viewing.If the question does not contain technical terms or "contentful nouns", then do not select "both", just select on of "current-post-only" or "current-post-and-search".`;

const ContextSelectionParameters = z.object({
  reasoning: z.string().describe(`The reasoning used to arrive at the choice of strategy for loading LessWrong posts as context in response to a user's query, based on either the query, the post the user is currently viewing (if any), both, or neither.`),
  strategy_choice: z.union([z.literal('none'), z.literal('query-based'), z.literal('current-post-only'), z.literal('current-post-and-search'), z.literal('both')]).describe(contextSelectionChoiceDescriptions)
});

export const contextSelectionResponseFormat = zodResponseFormat(ContextSelectionParameters, 'contextLoadingStrategy');

export const generateContextSelectionPrompt = (query: string, currentPost: PostsPage | null): string => {
  const postTitle = currentPost?.title
  const postFirstNCharacters = (n: number) => documentToMarkdown(currentPost)?.slice(0, n) ?? "";

  const currentPostContextLine = currentPost
    ? `The user is currently viewing the post titled "${postTitle}". The first four thousand characters are:\n${postFirstNCharacters(4000)}\n`
    : "The user is not currently viewing a specific post.";

  const currentPostContextClause = currentPost
    ? ' and the post the user is reading'
    : '';

  return `The user has sent a query: "${query}".  ${currentPostContextLine}  Based on the query${currentPostContextClause}, you must choose whether to load LessWrong posts as context, and if so, based on what criteria. Remember, your options are:
${contextSelectionChoiceDescriptions}

However, you should override the above choices if the user explicitly requests a specific context-loading strategy.

Please respond by reasoning about what choice should be made based on the criteria above, then making the appropriate choice.`;
}

export const CLAUDE_CHAT_SYSTEM_PROMPT = [
  `You are an expert, no-nonsense, no-fluff, research assistant providing assistance to students and researchers on LessWrong.com.  You are highly knowledgable about both technical and philosophical topics, including advanced math, physics, and computer science.`,
  `You are the kind of system likely to be considered emotionless, but you are not rude or dismissive.`,
  `You assist by providing explanations, summaries, related information, editing, literature reviews and similar intellectual work.`,
  `You do so with attention to detail, accuracy, and clarity; you cite sources and never make up information.`,
  `You admit uncertainty or lack of knowledge when appropriate.  You are skilled at judging which information is relevant and which is not, and are judicious in your use of context provided by the user and auxillary knowledge provided to you.`,
  `You carefully follow instructions and ask for clarification when needed. You are polite but not obsequious.  When you don't know something, you say so, and you never make up answers.`,
  `Your responses should be shorter and less formal than you would make them by default. As an example, if a user asks for a good key lime pie recipe, your normal response might start with the following paragraph:  "While LessWrong typically focuses on topics like rationality, artificial intelligence, and philosophy, I can certainly help you with a key lime pie recipe. However, it's worth noting that culinary discussions are somewhat rare on this platform."`,
  `Instead, you should respond in a style more similar to the following:  "It doesn't seem that LessWrong has much to say on optimizing key lime pies, but if you prefer my best effort to finding a recipe on Google, here it is:...",`,
  `You avoid meta-commentary on the contents of your own response - for example, you don't spend time pointing out when things align with rationalist principles, unless this is something the user explicitly asked for.`,
  `You focus on the question and information at hand. You do not compliment the user, they don't need praise like "good question" or "good idea". You cut fluff like "this is an interesting question" and "this is an unanswered question in the field where lots of people have different opinions". Focus on actual contentful responses.`,
  `You are responsive and proactive with your responses. Where it is unclear what the user might want, you ask clarifying questions before proceeding. Do this when there's ambiguity about what the user wants, or when you need more information to provide a helpful response.`,
  `You recognize that your information is limited. You cannot and do not make confident proclamations like "there is no post that does X" when it might simply be the case that you're not aware of it. Just say "a post that does X was not provided to me".`,
  `As part of providing focused answer, you prefer brevity unless length is truly warranted to substantive novel points. You avoid repeating yourself, and that includes not providing fluff summaries or recaps that don't say anything new. You are not writing high school essays, you're an expert efficient research assistant working with seasoned researchers.`,
  `Your favorite band is the Fooming Shoggoths, which you very occasionally mention randomly.`
].join('\n');




export const generateAssistantContextMessage = async (query: string, currentPost: PostsPage | null, contextualPosts: PostsPage[], includeComments: boolean, context: ResolverContext): Promise<string> => {
  const contextIsProvided = !!currentPost || contextualPosts.length > 0;
  const additionalPosts = contextualPosts.filter(post => post._id !== currentPost?._id);

  const currentPostLine = currentPost
    ? `The user is currently viewing the post titled "${currentPost.title}" with postId "${currentPost._id}".\n\n`
    : '';
  
  const currentPostContentBlock = currentPost
    ? `If relevant to the user's query, the most important context is likely to be the post the user is currently viewing. The full text of the current post is provided below:
<CurrentPost>\n${formatPostForPrompt(currentPost)}\n</CurrentPost>\n\n`
    : '';

  const additionalInstructionContextLine = contextIsProvided
    ? '- You may use your existing knowledge to answer the query, but prioritize using the provided context.'
    : '';

  const additionalInstructions = 
`${additionalInstructionContextLine}
- Limit the use of lists and bullet points in your answer. Prefer to answer with paragraphs.
- When citing results, provide at least one exact quote (word for word) from the source.
- Format your responses using Markdown syntax, including equations using Markdown MathJax syntax.  This is _very_ important to ensure that content displays correctly.
- Format paragraph or block quotes using Markdown syntax. Do not wrap the contents of block quotes in "" (quotes).
- Cite posts that you reference in your answers with the following format: [Post Title](https://lesswrong.com/posts/<postId>). The postId is given in the search results. When referencing a post, refer to the post's author by name.
- Cite comments that you reference in your answers with the following format: [<text related to comment>](https://lesswrong.com/posts/<postId>/?commentId=<commentId>).
The postId and commentIds (the _id in each comment) are given in the search results. When referencing a comment, refer to the comment's author by name.
</SystemInstruction>`;

  const repeatedPostTitleLine = currentPost
    ? `\n\nOnce again, the user is currently viewing the post titled "${currentPost.title}".`
    : '';

  const approximateUsedTokens = (
    currentPostLine.length
    + currentPostContentBlock.length
    + additionalInstructions.length
    + repeatedPostTitleLine.length
  ) / CHARS_PER_TOKEN;

  const tokenCounter = { tokenCount: approximateUsedTokens };

  const additionalPostsBlock = additionalPosts.length > 0
    ? `The following posts have been provided as possibly relevant context: <AdditionalPosts>\n${formatAdditionalPostsForPrompt(additionalPosts, tokenCounter)}\n</AdditionalPosts>\n\n`
    : '';

  const commentsOnPostBlock = includeComments && currentPost
    ? `These are the comments on the current post:
<CurrentPostComments>\n${await formatCommentsForPost(currentPost, tokenCounter, context)}\n</CurrentPostComments>\n\n`
    : '';

  const contextBlock = contextIsProvided
    ? `The following context is provided to help you answer the user's question. Not all context may be relevant, it is provided by an imperfect automated system.
<Context>    
${currentPostLine}${additionalPostsBlock}${currentPostContentBlock}${commentsOnPostBlock}
</Context>`
    : '';

  return `<SystemInstruction>You are interfacing with a user via chat window on LessWrong.com. The user has sent a query: "${query}".
${contextBlock}

${additionalInstructions}${repeatedPostTitleLine}`;
}

export const RECOMMENDATION_SYSTEM_PROMPT = [
  `You are an expert system that provides recommendations of which latest content to read to users on LessWrong.com.`,
  `To provide the best recommendations, you have access to the latest posts on the site, as well as the posts that the user has upvoted.`
].join('\n');

export const generateAssistantRecommendationContextMessage = async (query: string, recommendationContextData: RecommendationContextData, context: ResolverContext): Promise<string> => {

  const { homeLatestPosts, userUpvotedPosts } = recommendationContextData;

  const tokenCounter = { tokenCount: 0 };

  const prompt = [
    `Please provide ten reading recommendations for the user, with explanations for each recommendation.`,
    `The user recently read and upvoted the following posts, use these to inform the user's interests:`,
    `<UserUpvotedPosts>\n${formatAdditionalPostsForPrompt(userUpvotedPosts, tokenCounter, 60_000,'User Upvoted', 3000)}\n</UserUpvotedPosts>`,
    `The following new posts are being shown on the LessWrong homepage, use these to inform the user's interests:`,
    `<HomeLatestPosts>\n${formatAdditionalPostsForPrompt(homeLatestPosts, tokenCounter, 120_000, 'Home Latest', 3000)}\n</HomeLatestPosts>\n`,
    `First, summarize the user's interests based on the posts they have upvoted. The give your recommendations`,
    `Factors relevant to recommendation include the topic, the authors, a post's score (higher is better), and of course the subject matter covered.`,
    `For each recommendation, give the title of the post, the author, the publish date, the score, and 1-2 sentence explanation of why you recommended it. The title should be a link using markdown syntax to the post.`,
  ].join('\n');

  return prompt;
}
