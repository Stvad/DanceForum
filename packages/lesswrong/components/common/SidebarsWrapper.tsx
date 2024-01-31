import React, { useCallback, useMemo, useState } from 'react';
import { registerComponent } from '../../lib/vulcan-lib';
import type { AnchorOffset, ToCData, ToCSection, ToCSectionWithOffset } from '../../lib/tableOfContents';
import isEqual from 'lodash/isEqual';

// Context used to share a reference used to share the table of contents
// between the ToC itself, and the Header. The Header uses the ToC to change
// its icon (if a ToC is present) and to put the ToC inside NavigationMenu; it
// needs this Context because it doesn't have access to the post, which is on
// the wrong side of a whole lot of plumbing.
//
// The reference is to a function setToC, which puts the ToC in the state of
// Layout.
type ToCWithTitle = {title: string, sectionData: ToCData};
type SidebarsContextType = {
  toc: ToCWithTitle|null,
  tocTitleVisible: boolean,
  setToC: (toc: ToCWithTitle|null)=>void,
  setToCVisible: (visible: boolean)=>void,
  setToCTitleVisible: (visible: boolean)=>void,
  setToCOffsets: (offsets: AnchorOffset[])=>void,
  sideCommentsActive: boolean,
  setSideCommentsActive: (active: boolean)=>void,
}
export const SidebarsContext = React.createContext<SidebarsContextType|null>(null);

export const sectionsHaveOffsets = (sections: ToCSection[]): sections is ToCSectionWithOffset[] => {
  return sections.some(section => section.offset !== undefined) //TODO: Maybe should be every instead of some
}

const SidebarsWrapper = ({children}: {
  children: React.ReactNode
}) => {
  const [tocVisible, setTocVisibleState] = useState(true);
  const [tocTitleVisible, setTocTitleVisibleState] = useState(true);
  const [toc,setToCState] = useState<ToCWithTitle|null>(null);
  const [sideCommentsActive,setSideCommentsActive] = useState(false);
  
  const setToC = useCallback((toc: ToCWithTitle|null) => {
    setToCState(toc);
  }, []);

  const setToCVisible = useCallback((visible: boolean) => {
    setTocVisibleState(visible);
  }, []);

  const setToCTitleVisible = useCallback((visible: boolean) => {
    setTocTitleVisibleState(visible);
  }, [])

  const setToCOffsets = useCallback((offsets: AnchorOffset[]) => {
    if (!toc || sectionsHaveOffsets(toc.sectionData.sections)) return;
    
    const newSections = toc.sectionData.sections.map((section) => {
      const anchorOffset = offsets.find((offset) => offset.anchorHref === section.anchor);
      return {
        ...section,
        offset: anchorOffset?.offset,
      }
    })

    const newToCState = { ...toc, sectionData: { ...toc.sectionData, sections: newSections } }

    if (!isEqual(newToCState, toc)) {
      setToCState(newToCState);
    }
  }, [toc])
  
  const tocWithVisibility = useMemo(() => {
    if (tocVisible) {
      return toc
    }
    return null
  }, [tocVisible, toc])

  const sidebarsContext = useMemo((): SidebarsContextType => ({
    toc: tocWithVisibility,
    tocTitleVisible,
    setToC,
    setToCVisible,
    setToCTitleVisible,
    setToCOffsets,
    sideCommentsActive,
    setSideCommentsActive,
  }), [tocWithVisibility, tocTitleVisible, setToC, setToCVisible, setToCTitleVisible, setToCOffsets, sideCommentsActive, setSideCommentsActive]);

  return <SidebarsContext.Provider value={sidebarsContext}>
    {children}
  </SidebarsContext.Provider>
}

const SidebarsWrapperComponent = registerComponent("SidebarsWrapper", SidebarsWrapper);

declare global {
  interface ComponentTypes {
    SidebarsWrapper: typeof SidebarsWrapperComponent
  }
}
