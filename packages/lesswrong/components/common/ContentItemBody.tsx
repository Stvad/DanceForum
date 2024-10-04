import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { Components, registerComponent, validateUrl } from '../../lib/vulcan-lib';
import { captureException }from '@sentry/core';
import { linkIsExcludedFromPreview } from '../linkPreview/HoverPreviewLink';
import { toRange } from '../../lib/vendor/dom-anchor-text-quote';
import { rawExtractElementChildrenToReactComponent, reduceRangeToText, splitRangeIntoReplaceableSubRanges, wrapRangeWithSpan } from '../../lib/utils/rawDom';
import { withTracking } from '../../lib/analyticsEvents';
import { hasCollapsedFootnotes } from '@/lib/betas';
import isEqual from 'lodash/isEqual';

interface ExternalProps {
  /**
   * The content to show. This MUST come from a GraphQL resolver which does 
   * sanitization, such as post.contents.html
   */
  dangerouslySetInnerHTML: { __html: string };
  
  /**
   * Type-annotation reflecting that you can make a ref of this and call its
   * methods. (Doing so is handled by React, not by anything inside of this
   * using the ref prop)
   */
  ref?: React.RefObject<ContentItemBody>

  // className: Name of an additional CSS class to apply to this element.
  className?: string;

  /**
   * description: (Optional) A human-readable string describing where this
   * content came from. Used in error logging only, not displayed to users.
   */
  description?: string;

  /**
   * Passed through to HoverPreviewLink with link substitution. Only implemented
   * for hover-previews of tags in particular. (This was a solution to some
   * index pages in the Library being very slow to load).
   */
  noHoverPreviewPrefetch?: boolean;

  /**
   * If passed, all links in the content will have the nofollow attribute added.
   * Use for content that has risk of being spam (eg brand-new users).
   */
  nofollow?: boolean;

  /**
   * Extra elements to insert into the document (used for side-comment
   * indicators). This is a mapping from element IDs of block elements (in the
   * `id` attribute) to React elements to insert into those blocks.
   */
  idInsertions?: Record<string, React.ReactNode>;

  /**
   * Substrings to replace with an element. Used for highlighting inline
   * reactions.
   */
  replacedSubstrings?: Record<string, ContentReplacedSubstringComponentInfo>
  
  /**
   * Glossary to display in a tooltip when hovering over a term.
   */
  glossary?: Record<string, ContentReplacedSubstringComponentInfo>
}

export type ContentReplacedSubstringComponentInfo = {
  componentName: keyof ComponentTypes,
  props: AnyBecauseHard
};

interface ContentItemBodyProps extends ExternalProps, WithStylesProps, WithUserProps, WithLocationProps, WithTrackingProps {}
interface ContentItemBodyState {
  updatedElements: boolean,
  renderIndex: number
}

// The body of a post/comment/etc, created by taking server-side-processed HTML
// out of the result of a GraphQL query and adding some decoration to it. In
// particular, if this is the client-side render, adds scroll indicators to
// horizontally-scrolling LaTeX blocks.
//
// This doesn't apply styling (other than for the decorators it adds) because
// it's shared between entity types, which have styling that differs.
//
// Props:
//    dangerouslySetInnerHTML: Follows the same convention as
//      dangerouslySetInnerHTML on a div, ie, you set the HTML content of this
//      by passing dangerouslySetInnerHTML={{__html: "<p>foo</p>"}}.
export class ContentItemBody extends Component<ContentItemBodyProps,ContentItemBodyState> {
  private bodyRef: React.RefObject<HTMLDivElement>

  private replacedElements: Array<{
    replacementElement: React.ReactNode
    container: HTMLElement
  }>
  
  constructor(props: ContentItemBodyProps) {
    super(props);
    this.bodyRef = React.createRef<HTMLDivElement>();
    this.replacedElements = [];
    this.state = {
      updatedElements:false,
      renderIndex: 0,
    }
  }

  componentDidMount () {
    this.applyLocalModifications();
  }
  
  componentDidUpdate(prevProps: ContentItemBodyProps) {
    if (this.state.updatedElements) {
      const htmlChanged = prevProps.dangerouslySetInnerHTML?.__html !== this.props.dangerouslySetInnerHTML?.__html;
      const replacedSubstringsChanged = !isEqual(prevProps.replacedSubstrings, this.props.replacedSubstrings);
      if (htmlChanged || replacedSubstringsChanged) {
        this.replacedElements = [];
        this.setState({
          updatedElements: false,
          renderIndex: this.state.renderIndex+1,
        });
      }
    } else {
      this.applyLocalModifications();
    }
  }
  
  applyLocalModifications() {
    const element = this.bodyRef.current;
    if (element) {
      this.applyLocalModificationsTo(element);
      this.setState({updatedElements: true})
    }
  }

  applyLocalModificationsTo(element: HTMLElement) {
    try {
      // Replace substrings (for inline reacts) goes first, because it can split
      // elements that other substitutions work on (in particular it can split
      // an <a> tag into two).

      this.props.replacedSubstrings && this.replaceSubstrings(element, this.props.replacedSubstrings);

      this.props.glossary && this.replaceSubstrings(element, this.props.glossary, true);

      this.addCTAButtonEventListeners(element);

      this.markScrollableBlocks(element);
      this.collapseFootnotes(element);
      this.markHoverableLinks(element);
      this.markElicitBlocks(element);
      this.wrapStrawPoll(element);
      this.applyIdInsertions(element);
      this.exposeInternalIds(element);
    } catch(e) {
      // Don't let exceptions escape from here. This ensures that, if client-side
      // modifications crash, the post/comment text still remains visible.
      captureException(e);
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }
  
  
  /**
   * Return whether a given node from the DOM is inside this ContentItemBody.
   * Used for checking the selection-anchor in a mouse event, for inline reacts.
   */
  containsNode(node: Node): boolean {
    return !!this.bodyRef.current?.contains(node);
  }
  
  /**
   * Return a text stringified version of the contents (by stringifying from the
   * DOM). This is currently used only for warning that an inline-react
   * identifier is ambiguous; this isn't going to be nicely formatted and
   * shouldn't be presented to the user (for that, go to the source docuemnt and
   * get a markdown version).
   */
  getText(): string {
    return this.bodyRef.current?.textContent ?? ""
  }
  
  getAnchorEl(): HTMLDivElement|null {
    return this.bodyRef.current;
  }
  
  
  render() {
    const html = this.props.nofollow ? addNofollowToHTML(this.props.dangerouslySetInnerHTML.__html) : this.props.dangerouslySetInnerHTML.__html
    
    return (<React.Fragment>
      <div
        key={this.state.renderIndex}
        className={this.props.className}
        ref={this.bodyRef}
        dangerouslySetInnerHTML={{__html: html}}
      />
      {
        this.replacedElements.map(replaced => {
          return ReactDOM.createPortal(
            replaced.replacementElement,
            replaced.container
          );
        })
      }
    </React.Fragment>);
  }


  /**
   * Given an HTMLCollection, return an array of the elements inside it. Note
   * that this is covering for a browser-specific incompatibility: in Edge 17
   * and earlier, HTMLCollection has `length` and `item` but isn't iterable.
   */
  htmlCollectionToArray(collection: HTMLCollectionOf<HTMLElement>): HTMLElement[] {
    if (!collection) return [];
    let ret: Array<HTMLElement> = [];
    for (let i=0; i<collection.length; i++)
      ret.push(collection.item(i)!);
    return ret;
  }
  
  /**
   * Find elements inside the contents with the given classname, and return them
   * as an array.
   */
  getElementsByClassname(element: HTMLElement, classname: string): HTMLElement[] {
    const elementCollection = element.getElementsByClassName(classname);
    
    if (!elementCollection) return [];
    
    let ret: Array<HTMLElement> = [];
    for (let i=0; i<elementCollection.length; i++) {
      // Downcast Element->HTMLElement because the HTMLCollectionOf type doesn't
      // know that getElementsByClassName only returns elements, not text
      // nodes/etc
      ret.push(elementCollection.item(i) as HTMLElement);
    }
    return ret;
  }
  
  // Find elements that are too wide, and wrap them in HorizScrollBlock.
  // This is client-only because it requires measuring widths.
  markScrollableBlocks = (element: HTMLElement) => {
    // Iterate through top-level (block) elements, checking their width. If any
    // of them overflow the container, they'll get replaced by a
    // ScrollableBlock.
    const allTopLevelBlocks = element.childNodes;
    for (let i=0; i<allTopLevelBlocks.length; i++) {
      const block = allTopLevelBlocks[i];
      if (block.nodeType === Node.ELEMENT_NODE) {
        const blockAsElement = block as HTMLElement;
        
        // Check whether this block is wider than the content-block it's inside
        // of, and if so, wrap it in a horizontal scroller. This makes wide
        // LaTeX formulas and tables functional on mobile.
        // We also need to check that this element has nonzero width, because of
        // an odd bug in Firefox where, when you open a tab in the background,
        // it runs JS but doesn't do page layout (or does page layout as-if the
        // page was zero width?) Without this check, you would sometimes get a
        // spurious horizontal scroller on every paragraph-block.
        if (blockAsElement.scrollWidth > this.bodyRef.current!.clientWidth+1
          && this.bodyRef.current!.clientWidth > 0)
        {
          this.addHorizontalScrollIndicators(blockAsElement);
        }
      }
    }
  }
  
  // Given an HTML block element which has horizontal scroll, wrap it in a
  // <HorizScrollBlock>.
  addHorizontalScrollIndicators = (block: HTMLElement) => {
    const ScrollableContents = rawExtractElementChildrenToReactComponent(block)
    this.replaceElement(block, <Components.HorizScrollBlock>
      <ScrollableContents/>
    </Components.HorizScrollBlock>);
  };

  forwardAttributes = (node: HTMLElement|Element) => {
    const result: Record<string, unknown> = {};
    const attrs = node.attributes ?? [];
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      if (attr.name === "class") {
        result.className = attr.value;
      } else {
        result[attr.name] = attr.value;
      }
    }
    return result;
  }


  collapseFootnotes = (body: HTMLElement) => {
    if (!hasCollapsedFootnotes || !body) {
      return;
    }

    const footnotes = body.querySelector(".footnotes");
    if (footnotes) {
      let innerHTML = footnotes.innerHTML;
      if (footnotes.tagName !== "SECTION") {
        innerHTML = `<section>${innerHTML}</section>`;
      }
      const collapsedFootnotes = (
        <Components.CollapsedFootnotes
          footnotesHtml={innerHTML}
          attributes={this.forwardAttributes(footnotes)}
        />
      );
      this.replaceElement(footnotes, collapsedFootnotes);
    }
  }

  markHoverableLinks = (element: HTMLElement) => {
    const linkTags = this.htmlCollectionToArray(element.getElementsByTagName("a"));
    for (let linkTag of linkTags) {
      const href = linkTag.getAttribute("href");
      if (!href || linkIsExcludedFromPreview(href) || linkTag.classList.contains('ck-cta-button'))
        continue;

      const TagLinkContents = rawExtractElementChildrenToReactComponent(linkTag);
      const id = linkTag.getAttribute("id") ?? undefined;
      const rel = linkTag.getAttribute("rel") ?? undefined;
      const replacementElement = <Components.HoverPreviewLink
        href={href}
        contentSourceDescription={this.props.description}
        id={id}
        rel={rel}
        noPrefetch={this.props.noHoverPreviewPrefetch}
      >
        <TagLinkContents/>
      </Components.HoverPreviewLink>
      this.replaceElement(linkTag, replacementElement);
    }
  }
  
  markElicitBlocks = (element: HTMLElement) => {
    const elicitBlocks = this.getElementsByClassname(element, "elicit-binary-prediction");
    for (const elicitBlock of elicitBlocks) {
      if (elicitBlock.dataset?.elicitId) {
        const replacementElement = <Components.ElicitBlock questionId={elicitBlock.dataset.elicitId}/>
        this.replaceElement(elicitBlock, replacementElement)
      }
    }
  }

  /**
   * Find embedded Strawpoll blocks (an iframe integration to a polling site),
   * and replace them with WrappedStrawPoll, which causes them to be a request
   * to log in if you aren't logged in. See the StrawPoll block in `embedConfig`
   * in `editorConfigs.js` (compiled into the CkEditor bundle). The DOM
   * structure of the embed looks like:
   *
   *   <div class="strawpoll-embed" id="strawpoll_{pollId}>
   *     <iframe src="https://strawppoll.com/embed/polls/{pollId}"></iframe>
   *   </div>
   *
   * (FIXME: The embed-HTML in editorConfigs also has a bunch of stuff in it
   * that's unnecessary, which is destined to get stripped out by the HTML
   * validator)
   */
  wrapStrawPoll = (element: HTMLElement) => {
    const strawpollBlocks = this.getElementsByClassname(element, "strawpoll-embed");
    for (const strawpollBlock of strawpollBlocks) {
      const id = strawpollBlock.getAttribute("id");
      const iframe = strawpollBlock.getElementsByTagName("iframe");
      const iframeSrc = iframe[0]?.getAttribute("src") ?? "";
      const replacementElement = <Components.WrappedStrawPoll id={id} src={iframeSrc} />
      this.replaceElement(strawpollBlock, replacementElement)
    }
  }

  /**
   * CTA buttons added in ckeditor need the following things doing to make them fully functional:
   * - Convert data-href to href
   * - Add analytics to button clicks
   */
  addCTAButtonEventListeners = (element: HTMLElement) => {
    const ctaButtons = element.getElementsByClassName('ck-cta-button');
    for (let i = 0; i < ctaButtons.length; i++) {
      const button = ctaButtons[i] as HTMLAnchorElement;
      const dataHref = button.getAttribute('data-href');
      if (dataHref) {
        button.setAttribute('href', validateUrl(dataHref));
      }
      button.addEventListener('click', () => {
        this.props.captureEvent("ctaButtonClicked", {href: dataHref})
      })
    }
  }
  
  replaceSubstrings = (
    element: HTMLElement,
    replacedSubstrings: Record<string, ContentReplacedSubstringComponentInfo>,
    replaceAll = false,
  ) => {
    if (replacedSubstrings) {
      // Sort substrings by length descending to handle overlapping substrings
      const sortedSubstrings = Object.keys(replacedSubstrings).sort((a, b) => b.length - a.length);
  
      for (let str of sortedSubstrings) {
        const replacement = replacedSubstrings[str]!;
        const ReplacementComponent = Components[replacement.componentName];
        const replacementComponentProps = replacement.props;
        const searchString = str.trim();
        
        try {
          // Collect all ranges to replace in document order
          const rangesToReplace: { range: Range; isFirst: boolean }[] = [];
          let isFirst = true;
  
          const collectRanges = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              let textContent = node.textContent || "";
              let index = textContent.indexOf(searchString);
              while (index !== -1) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + searchString.length);
                rangesToReplace.push({ range, isFirst });
                if (isFirst) isFirst = false;
                index = textContent.indexOf(searchString, index + searchString.length);
                if (!replaceAll && isFirst === false) break;
              }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              node.childNodes.forEach(child => collectRanges(child));
            }
          };
  
          collectRanges(element);
  
          // Replace from the end to avoid index shifting
          rangesToReplace
            .reverse()
            .forEach(({ range, isFirst }) => {
              const span = wrapRangeWithSpan(range);
              if (span) {
                const WrappedSpan = rawExtractElementChildrenToReactComponent(span);
                const replacementNode = (
                  <ReplacementComponent
                    {...replacementComponentProps}
                    replacedSubstrings={replacedSubstrings}
                    isFirstOccurrence={isFirst}
                  >
                    <WrappedSpan />
                  </ReplacementComponent>
                );
                this.replaceElement(span, replacementNode);
              }
            });
  
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`Error highlighting string ${str} in ${this.props.description ?? "content block"}`, e);
        }
      }
    }
  }

  applyIdInsertions = (element: HTMLElement) => {
    if (!this.props.idInsertions) return;
    for (let id of Object.keys(this.props.idInsertions)) {
      const addedElement = this.props.idInsertions[id];
      const container = document.getElementById(id);
      // TODO: Check that it's inside this ContentItemBody
      if (container) this.insertElement(container, <>{addedElement}</>);
    }
  }

  /**
   * Convert data-internal-id to id, handling duplicates
   */
  exposeInternalIds = (element: HTMLElement) => {
    const elementsWithDataInternalId = element.querySelectorAll('[data-internal-id]');
    elementsWithDataInternalId.forEach((el: Element) => {
      const internalId = el.getAttribute('data-internal-id');
      if (internalId && !document.getElementById(internalId)) {
        if (!el.id) {
          el.id = internalId;
        } else {
          const wrapperSpan = document.createElement('span');
          wrapperSpan.id = internalId;
          while (el.firstChild) {
            wrapperSpan.appendChild(el.firstChild);
          }
          el.appendChild(wrapperSpan);
        }
      }
    });
  }

  replaceElement = (replacedElement: HTMLElement|Element, replacementElement: React.ReactNode) => {
    const replacementContainer = document.createElement("span");
    if (replacementContainer) {
      this.replacedElements.push({
        replacementElement: replacementElement,
        container: replacementContainer,
      });
      replacedElement.parentElement?.replaceChild(replacementContainer, replacedElement);
    }
  }
  
  insertElement = (container: HTMLElement, insertedElement: React.ReactNode) => {
    const insertionContainer = document.createElement("span");
    this.replacedElements.push({
      replacementElement: insertedElement,
      container: insertionContainer,
    });
    container.prepend(insertionContainer);
  }
}

const addNofollowToHTML = (html: string): string => {
  return html.replace(/<a /g, '<a rel="nofollow" ')
}

const ContentItemBodyComponent = registerComponent<ExternalProps>("ContentItemBody", ContentItemBody, {
  hocs: [withTracking],
  
  // Memoization options. If this spuriously rerenders, then voting on a comment
  // that contains a YouTube embed causes that embed to visually flash and lose
  // its place.
  areEqual: {
    ref: "ignore",
    "dangerouslySetInnerHTML": "deep",
    replacedSubstrings: "deep"
  },
});

declare global {
  interface ComponentTypes {
    ContentItemBody: typeof ContentItemBodyComponent
  }
}
