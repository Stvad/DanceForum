import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { registerComponent } from '../../lib/vulcan-lib';
import { useMulti } from '@/lib/crud/withMulti';
import { useCurrentUser } from '../common/withUser';
import sortBy from 'lodash/sortBy';
import { useSingle } from '@/lib/crud/withSingle';
import { gql, useMutation } from '@apollo/client';
import { useUpdate } from '@/lib/crud/withUpdate';
import keyBy from 'lodash/keyBy';
import { randomId } from '@/lib/random';
import { LlmCreateConversationMessage, useOnServerSentEvent } from '../hooks/useUnreadNotifications';

interface PromptContextOptions {
  postId?: string,
  useRag?: boolean
  includeComments?: boolean
}

type NewLlmMessage = Pick<LlmMessagesFragment, 'userId' | 'role' | 'content'> & { conversationId?: string };
type PreSaveLlmMessage = Omit<NewLlmMessage, 'role'>;
type NewLlmConversation = Pick<LlmConversationsWithMessagesFragment, 'userId'> & { _id: string, title?: string, messages: NewLlmMessage[] };
type LlmConversationWithPartialMessages = LlmConversationsFragment & { messages: Array<LlmMessagesFragment | NewLlmMessage> };
type LlmConversation = NewLlmConversation | LlmConversationWithPartialMessages;
type LlmConversationsDict = Record<string, LlmConversation>;

interface LlmChatContextType {
  orderedConversations: LlmConversationsFragment[]
  currentConversation?: LlmConversation
  submitMessage: ( query: string, currentPostId?: string) => void
  setCurrentConversation: (conversationId?: string) => void
  archiveConversation: (conversationId: string) => void
  loading: boolean
}

export const LlmChatContext = React.createContext<LlmChatContextType|null>(null);

export const useLlmChat = (): LlmChatContextType => {
  const result = React.useContext(LlmChatContext);
  if (!result) throw new Error("useLlmChat called but not a descendent of LlmChatWrapper");
  return result;
}


const LlmChatWrapper = ({children}: {
  children: React.ReactNode
}) => {

  const currentUser = useCurrentUser();

  const [sendClaudeMessage] = useMutation(gql`
    mutation sendClaudeMessageMutation($newMessage: ClientLlmMessage!, $promptContextOptions: PromptContextOptions!, $newConversationChannelId: String) {
      sendClaudeMessage(newMessage: $newMessage, promptContextOptions: $promptContextOptions, newConversationChannelId: $newConversationChannelId)
    }
  `)

  const [getClaudeLoadingMessages] = useMutation(gql`
    mutation getClaudeLoadingMessagesMutation($messages: [ClientLlmMessage!]!, $postId: String) {
      getClaudeLoadingMessages(messages: $messages, postId: $postId)
    }
  `)

  const { mutate: updateConversation } = useUpdate({
    collectionName: "LlmConversations",
    fragmentName: "LlmConversationsFragment"
  })

  const { results: userLlmConversations } = useMulti({
    collectionName: "LlmConversations",
    fragmentName: "LlmConversationsFragment",
    terms: { view: "llmConversationsWithUser", userId: currentUser?._id },
    skip: !currentUser,
    enableTotal: false,
  });

  const userLlmConversationsDict = useMemo(() => {
    const conversationsWithMessagesArray = userLlmConversations?.map((conversation) => ({...conversation, messages: []})) 
    return keyBy(conversationsWithMessagesArray, '_id');
  }, [userLlmConversations]);

  const sortedConversations = useMemo(() => {
    return sortBy(userLlmConversations, (conversation) => -(conversation.lastUpdatedAt ?? conversation.createdAt));
  }, [userLlmConversations]);

  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<LlmConversationsDict>(userLlmConversationsDict);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(sortedConversations[0]?._id);

  const { document: currentConversationWithMessages } = useSingle({
    collectionName: "LlmConversations",
    fragmentName: "LlmConversationsWithMessagesFragment",
    documentId: currentConversationId,
    skip: !currentConversationId,
  });

  // TODO: probably break this out into separate update operations
  const updateConversations = useCallback((newConversation: LlmConversation | LlmConversationsWithMessagesFragment) => {
    setConversations({ ...conversations, [newConversation._id]: newConversation });
  }, [conversations, setConversations]);

  const hydrateNewConversation = useCallback((newConversationEvent: LlmCreateConversationMessage) => {
    const { title, conversationId, createdAt, userId, channelId } = newConversationEvent;
    const { [channelId]: { messages }, ...rest } = conversations;

    const hydratedConversation: LlmConversationWithPartialMessages = {
      _id: conversationId,
      title,
      messages,
      createdAt: new Date(createdAt),
      deleted: false,
      lastUpdatedAt: new Date(createdAt),
      userId
    };

    const updatedConversations = { [conversationId]: hydratedConversation, ...rest };

    setCurrentConversationId(conversationId);
    setConversations(updatedConversations);
  }, [conversations]);

  // TODO: Ensure code is sanitized against injection attacks
  const submitMessage = useCallback(async (query: string, currentPostId?: string) => {
    if (!currentUser) {
      return;
    }

    const newConversationChannelId = randomId();
    const isExistingConversation = !!currentConversationId;

    const preSaveConversation = {
      _id: newConversationChannelId,
      userId: currentUser._id,
      messages: [],
      createdAt: new Date()
    };

    const currentConversation = isExistingConversation
      ? conversations[currentConversationId]
      : preSaveConversation;

    // Sent to the server to create a new message
    const preSaveMessage: PreSaveLlmMessage = { conversationId: currentConversationId, userId: currentUser._id, content: query };

    // We don't send the role to the server
    const newClientMessage: NewLlmMessage = { ...preSaveMessage, role: 'user' };
    const updatedMessages = [...currentConversation?.messages ?? [], newClientMessage];
    const conversationWithNewUserMessage: LlmConversation = { ...currentConversation, messages: updatedMessages };

    // Update Client Display
    setLoading(true);
    updateConversations(conversationWithNewUserMessage);

    if (!isExistingConversation) {
      setCurrentConversationId(newConversationChannelId);
    }

    // TO-DO: where to cause scrolling??
    // if (messagesRef.current) {
    //   messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    // }

    const promptContextOptions: PromptContextOptions = { postId: currentPostId, includeComments: true /* TODO: not always true? */ };

    void sendClaudeMessage({
      variables: {
        newMessage: preSaveMessage,
        promptContextOptions,
        ...(currentConversationId ? {} : { newConversationChannelId }),
      }
    });
  }, [currentUser, conversations, currentConversationId, sendClaudeMessage, updateConversations]);

  const setCurrentConversation = useCallback(setCurrentConversationId, []);

  const archiveConversation = useCallback(async (conversationId: string) => {
    if (!currentUser) {
      return;
    }

    if (currentConversationId === conversationId) {
      setCurrentConversationId(undefined);
    }

    // TODO: ensure list of available convos is updated
    // Shouldn't this happen by default if the view we're using is filtering for `deleted: false`?
    void updateConversation({
      selector: { _id: conversationId },
      data: {
        deleted: true
      }
    })
  }, [currentUser, currentConversationId, updateConversation]);

  const currentConversation = useMemo(() => (
    currentConversationId ? conversations[currentConversationId] : undefined
  ), [conversations, currentConversationId]);

  useOnServerSentEvent('llmStreamContent', currentUser, (message) => {
    if (!currentUser) {
      return;
    }

    const { conversationId, content, previousUserMessage } = message.data;

    const currentConversation = conversations[conversationId];
    const updatedMessages = [...currentConversation.messages];
    const lastMessageInConversation = updatedMessages.slice(-1)[0];
    const lastClientMessageIsAssistant = lastMessageInConversation?.role === 'assistant';

    const newMessage: NewLlmMessage = { 
      conversationId,
      userId: currentUser._id,
      // TODO: pass back role through stream, maybe even the whole message object?
      role: "assistant", 
      content,
    };
    
    // previousUserMessage only gets sent with the first stream event for any given message response
    if (previousUserMessage && lastClientMessageIsAssistant) {
      updatedMessages.push(previousUserMessage, newMessage);
    } else {
      // Since we're sending an aggregate buffer rather than diffs, we need to replace the last message in the conversation each time we get one (after the first time)
      if (lastClientMessageIsAssistant) {
        updatedMessages.pop();
      }
      updatedMessages.push(newMessage);
    }

    const updatedConversation = { ...currentConversation, messages: updatedMessages };
    
    // TODO: per-conversation loading state
    setLoading(false);
    updateConversations(updatedConversation);
  });

  useOnServerSentEvent('llmStreamEnd', currentUser, (message) => {
    // TODO: per-conversation loading state
    setLoading(false);
  });

  useOnServerSentEvent('llmCreateConversation', currentUser, (message) => {
    hydrateNewConversation(message);
  });

  useEffect(() => {
    if (currentConversationWithMessages) {
      const clientSideConversationState = conversations[currentConversationWithMessages._id];
      if (currentConversationWithMessages.messages.length > clientSideConversationState.messages.length) {
        updateConversations(currentConversationWithMessages);
      }
    }
  }, [currentConversationWithMessages, conversations, updateConversations]);

  const llmChatContext = useMemo((): LlmChatContextType => ({
    currentConversation,
    orderedConversations: sortedConversations,
    submitMessage,
    setCurrentConversation,
    archiveConversation,
    loading,
  }), [submitMessage, setCurrentConversation, archiveConversation, loading, currentConversation, sortedConversations]);

  return <LlmChatContext.Provider value={llmChatContext}>
    {children}
  </LlmChatContext.Provider>
}

const LlmChatWrapperComponent = registerComponent("LlmChatWrapper", LlmChatWrapper);

declare global {
  interface ComponentTypes {
    LlmChatWrapper: typeof LlmChatWrapperComponent
  }
}
