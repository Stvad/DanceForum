import React, { ChangeEvent } from 'react';
import ClickAwayListener, { ClickAwayEvent } from '../../lib/vendor/react-click-away-listener';
import { registerComponent } from '../../lib/vulcan-lib/components';

/**
 * Wrapped to ensure that "onClick" is the default mouse event.
 * Without it, this would be a "onMouseUp" event, which happens BEFORE "onClick",
 * and resulted in some annoying behavior. Also MUI v5 defaults this to "onClick".
 */
const LWClickAwayListener = ({onClickAway, children, style, className}: {
  onClickAway: (ev: ClickAwayEvent) => void,
  children: React.ReactElement,
  style?: React.CSSProperties,
  className?: string,
}) => {
  return (
    <ClickAwayListener
      onClickAway={ev => {
        onClickAway(ev);
      }}
    >
      <span style={style} className={className}>
        {children}
      </span>
    </ClickAwayListener>
  );
}

const LWClickAwayListenerComponent = registerComponent('LWClickAwayListener', LWClickAwayListener);

declare global {
  interface ComponentTypes {
    LWClickAwayListener: typeof LWClickAwayListenerComponent
  }
}
