// TODO: Import component in components.ts
import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import classNames from 'classnames';
import DeferRender from '../common/DeferRender';
import Button from '@material-ui/core/Button';
import { useMessages } from '../common/withMessages';
import Select from '@material-ui/core/Select';
import CloseIcon from '@material-ui/icons/Close';
import { useLocation } from "../../lib/routeUtil";
import { useLlmChat } from './LlmChatWrapper';
import type { Editor } from '@ckeditor/ckeditor5-core';
import CKEditor from '@/lib/vendor/ckeditor5-react/ckeditor';
import { getCkCommentEditor } from '@/lib/wrapCkEditor';
import { forumTypeSetting } from '@/lib/instanceSettings';
import { mentionPluginConfiguration } from '@/lib/editor/mentionsConfig';
import { ckEditorStyles } from '@/themes/stylePiping';
import { HIDE_LLM_CHAT_GUIDE_COOKIE } from '@/lib/cookies/cookies';
import { useCookiesWithConsent } from '../hooks/useCookiesWithConsent';

const styles = (theme: ThemeType) => ({
  root: {
    height: "calc(100vh - 160px)"
  },
  subRoot: {
    display: "flex",
    flexDirection: "column",
    height: "100%"
  },
  submission: {
    margin: 10,
    display: "flex",
    padding: 20,
    ...theme.typography.commentStyle,
  },
  editor: {
    minHeight: 100,
    '& .ck.ck-content': {
      minHeight: 100,
    },
    ...ckEditorStyles(theme),
  },
  inputTextbox: {
    padding: 16,
    margin: 10,
    borderRadius: 4,
    minHeight: 100,
    maxHeight: 200,
    backgroundColor: theme.palette.panelBackground.commentNodeEven,
    overflow: 'scroll',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
  },
  welcomeGuide: {
    margin: 10,
    display: "flex",
    flexDirection: "column",
  },
  welcomeGuideText: {
    padding: 20,
    backgroundColor: theme.palette.grey[100],
    borderRadius: 10,
  },
  welcomeGuideButton: {
    cursor: "pointer",
    opacity: 0.8,
    alignSelf: "flex-end",
    fontStyle: "italic",
  },
  chatMessage: {
    padding: 20,
    margin: 10,
    borderRadius: 10,
    backgroundColor: theme.palette.grey[100],
  },
  chatMessageContent: {
  },
  userMessage: {
    backgroundColor: theme.palette.grey[300],
  },
  messages: {
    overflowY: "scroll",
    flexGrow: 1,
  },
  options: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    fontFamily: theme.palette.fonts.sansSerifStack,
    marginLeft: 10
  },
  checkbox: {
    padding: 8
  },
  select: {
    // TODO: maybe really the styling of the options section should be flex display and flex grow stuff
    maxWidth: 250,
  },
  menuItem: {
    zIndex: theme.zIndexes.languageModelChat + 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  deleteConvoIcon: {
    marginLeft: 10,
    cursor: "pointer",
    opacity: 0.8,
    width: 16
  },
  loadingSpinner: {
    marginTop: 10
  }
});

interface LlmConversationMessage {
  role: string
  content: string
  displayContent?: string
}

const NEW_CONVERSATION_MENU_ITEM = "New Conversation";

const LLMChatMessage = ({message, classes}: {
  message: LlmConversationMessage,
  classes: ClassesType<typeof styles>,
}) => {

  const { ContentItemBody, ContentStyles } = Components

  const { role, content, displayContent } = message

  return <ContentStyles contentType="llmChat" className={classes.chatMessageContent}>
    <ContentItemBody
      className={classNames(classes.chatMessage, {[classes.userMessage]: role==='user'})}
      dangerouslySetInnerHTML={{__html: displayContent ?? content}}
    />
</ContentStyles>
}

const LLMInputTextbox = ({onSubmit, classes}: {
  onSubmit: (message: string) => void,
  // conversationId?: string,
  classes: ClassesType<typeof styles>,
}) => {
  const { ContentStyles } = Components;
  
  const [currentMessage, setCurrentMessage] = useState('');
  const ckEditorRef = useRef<CKEditor<any> | null>(null);
  const editorRef = useRef<Editor | null>(null);

  // TODO: we probably want to come back to this and enable cloud services for image uploading
  const editorConfig = {
    placeholder: 'Type here.  Ctrl/Cmd + Enter to submit.',
    mention: mentionPluginConfiguration,
  };

  // We need to pipe through the `conversationId` and do all of this eventListener setup/teardown like this because
  // otherwise messages get submitted to whatever conversation was "current" when the editor was initially loaded
  // Running this useEffect whenever either the conversationId or onSubmit changes ensures we remove and re-attach a fresh event listener with the correct "targets"
  useEffect(() => {
    const currentEditorRefValue = ckEditorRef.current;

    const options = { capture: true };
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.keyCode === 13) {
        event.stopPropagation();
        event.preventDefault();
        const currentEditorContent = editorRef.current?.getData();
        currentEditorContent && void onSubmit(currentEditorContent);
        setCurrentMessage('');
      }
    };
  
    const internalEditorRefInstance = (currentEditorRefValue as AnyBecauseHard).domContainer?.current;
    if (internalEditorRefInstance) {
      internalEditorRefInstance.addEventListener('keydown', handleKeyDown, options);
    }

    return () => {
      const internalEditorRefInstance = (currentEditorRefValue as AnyBecauseHard)?.domContainer?.current;
      if (internalEditorRefInstance) {
        internalEditorRefInstance.removeEventListener('keydown', handleKeyDown, options);
      }
    }
  }, [onSubmit]);

  // TODO: styling and debouncing
  return <ContentStyles className={classes.inputTextbox} contentType='comment'>
    <div className={classes.editor}>
      <CKEditor
        data={currentMessage}
        ref={ckEditorRef}
        editor={getCkCommentEditor(forumTypeSetting.get())}
        isCollaborative={false}
        onChange={(_event, editor: Editor) => {
          // debouncedValidateEditor(editor.model.document)
          // If transitioning from empty to nonempty or nonempty to empty,
          // bypass throttling. These cases don't have the performance
          // implications that motivated having throttling in the first place,
          // and this prevents a timing bug with form-clearing on submit.
          setCurrentMessage(editor.getData());

          // if (!editor.data.model.hasContent(editor.model.document.getRoot('main'))) {
          //   throttledSetCkEditor.cancel();
          //   setCurrentMessage(editor.getData());
          // } else {
          //   throttledSetCkEditor(() => editor.getData())
          // }
        }}
        onReady={(editor) => {
          editorRef.current = editor;
        }}
        config={editorConfig}
      />
    </div>
  </ContentStyles>
}

const welcomeGuideHtml = `<h1>Welcome to the LessWrong LLM Chat!</h1><ul><li>Ctrl/Cmd + Enter to submit</li><li>The LLM chat interface is currently hooked up to Claude Sonnet 3.5</li><li>While in development, LW is paying for the usage. This will likely change later.</li><li>LaTeX is supported both on input and output</li><li>Images are not yet supported</li><li style="color: #bf360c;">While this feature is under heavy development, the LessWrong team will read conversations to help us with product iteration.</li></ul><h1>Loading Context</h1><p><strong>Currently, context loading only happens with the first message in a conversation</strong></p><p>When you start a new chat, your very first message is analyzed for potentially relevant context based on the text of your query and the post you are currently viewing (if any). The system will decide whether or not to load in posts and comments related to your query, your current post, both, or neither.</p><p>The kinds of requests you can make include but are not limited to:</p><p><i>About the current post</i></p><blockquote><p>"Please give a tl;dr of this post and tell me three surprising things in it."</p><p>&lt;copy-paste section of post&gt; "Please explain this to me including worked examples and explanations of the math notation."</p><p>"What the objections to the OP in the comments and how did the author respond to them?"</p><p>"What are background posts that would help understand this?"</p></blockquote><p><i>Generally</i></p><blockquote><p>"Can you give me an overview of Infrabayesianism?"</p><p>"Please give me an of the Sleeping Beauty problem and its significance?</p></blockquote><p>(our chat is great for asking about niche LessWrong content)</p><p>Feel free to try out other kinds of questions!!</p><p><em>(This guide can be hidden - see button in top right.)</em></p>`

export const ChatInterface = ({classes}: {
  classes: ClassesType<typeof styles>,
}) => {
  const { Loading, MenuItem, ContentStyles, ContentItemBody } = Components;

  const { currentConversation, setCurrentConversation, archiveConversation, orderedConversations, submitMessage, currentConversationLoading } = useLlmChat();

  const lengthOfMostRecentMessage = currentConversation?.messages.slice(-1)[0]?.content.length

  const { flash } = useMessages();

  // TODO: come back and refactor this to use currentRoute & matchPath to get the url parameter instead
  const { location } = useLocation();
  const { pathname } = location;
  const currentPostId = pathname.match(/\/posts\/([^/]+)\/[^/]+/)?.[1];

  const messagesRef = useRef<HTMLDivElement>(null)
  // useEffect to scroll to bottom of chat history after new message is added or most recent message is updated (because of streaming)
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [currentConversation?.messages.length, lengthOfMostRecentMessage]);

  const [cookies, setCookies] = useCookiesWithConsent([HIDE_LLM_CHAT_GUIDE_COOKIE])
  const showGuide = cookies[HIDE_LLM_CHAT_GUIDE_COOKIE] !== "true";
  const setShowGuide = (show: boolean) => {
    setCookies(HIDE_LLM_CHAT_GUIDE_COOKIE, show ? "false" : "true")
  }

  const llmChatGuide = <ContentStyles contentType="llmChat" className={classes.welcomeGuide}>
    <div 
      onClick={() => setShowGuide(!showGuide)} 
      className={classes.welcomeGuideButton}
    >
      {showGuide ? "Hide Guide" : "Show LLM Guide"}
    </div>
    {showGuide && <ContentItemBody
      className={classNames(classes.welcomeGuideText)}
      dangerouslySetInnerHTML={{__html: welcomeGuideHtml}}
    />}
  </ContentStyles>

  const messagesForDisplay = <div className={classes.messages} ref={messagesRef}>
    {llmChatGuide}
    {currentConversation?.messages.map((message, index) => (
      <LLMChatMessage key={index} message={message} classes={classes} />
    ))}
  </div>

  const exportHistoryToClipboard = () => {
    if (!currentConversation) return
    const conversationHistory = currentConversation.messages.filter(({role}) => ['user', 'assistant', 'user-context'].includes(role))
    const formattedChatHistory = conversationHistory.map(({role, content}) => `${role.toUpperCase()}: ${content}`).join("\n")
    void navigator.clipboard.writeText(formattedChatHistory)
    flash('Chat history copied to clipboard')
  }

  const onSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSelection = event.target.value;
    const newSelectionId = newSelection === "New Conversation"
      ? undefined
      : newSelection;

    setCurrentConversation(newSelectionId);
  }

  const deleteConversation = (ev: React.MouseEvent, conversationId: string) => {
    // TODO: figure out if we need both of these or just one (i.e. to prevent selection of the menu item)
    ev.preventDefault();
    ev.stopPropagation();
    archiveConversation(conversationId);
  };

  const conversationSelect = <Select 
    onChange={onSelect} 
    value={currentConversation?._id ?? NEW_CONVERSATION_MENU_ITEM}
    disableUnderline
    className={classes.select}
    MenuProps={{style: {zIndex: 10000000002}}} // TODO: figure out sensible z-index stuff
    renderValue={(conversationId: string) => orderedConversations.find(c => c._id === conversationId)?.title ?? NEW_CONVERSATION_MENU_ITEM}
    >
      {
        orderedConversations.reverse().map(({ title, _id }, index) => (
          <MenuItem key={index} value={_id} className={classes.menuItem}>
            {title ?? "...Title Pending..."}
            <CloseIcon onClick={(ev) => deleteConversation(ev, _id)} className={classes.deleteConvoIcon} />
          </MenuItem>
      ))}
      <MenuItem value={NEW_CONVERSATION_MENU_ITEM} className={classes.menuItem}>
        New Conversation
      </MenuItem>
    </Select>;


  const options = <div className={classes.options}>
    <Button onClick={() => setCurrentConversation()}>
      New Chat
    </Button>
    <Button onClick={exportHistoryToClipboard} disabled={!currentConversation}>
      Export
    </Button>
    {conversationSelect}
  </div>  

  const handleSubmit = useCallback((message: string) => {
    submitMessage(message, currentPostId);
  }, [currentPostId, submitMessage]);

  return <div className={classes.subRoot}>
    {messagesForDisplay}
    {currentConversationLoading && <Loading className={classes.loadingSpinner}/>}
    <LLMInputTextbox
      onSubmit={handleSubmit}
      // conversationId={currentConversation?._id}
      classes={classes}
    />
    {options}
  </div>
}


// Wrapper component needed so we can use deferRender
export const LanguageModelChat = ({classes}: {
  classes: ClassesType<typeof styles>,
}) => {

  return <DeferRender ssr={false}>
    <div className={classes.root}>
      <ChatInterface classes={classes} />
    </div>
  </DeferRender>
}

const LanguageModelChatComponent = registerComponent('LanguageModelChat', LanguageModelChat, {styles});

declare global {
  interface ComponentTypes {
    LanguageModelChat: typeof LanguageModelChatComponent
  }
}
