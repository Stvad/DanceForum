import React, { Component, CSSProperties } from 'react' // eslint-disable-line import/no-unresolved
import PropTypes from 'prop-types'
import shallowequal from 'shallowequal'
import raf from 'raf'
import shouldUpdate from './shouldUpdate'

const noop = () => {}

interface HeadroomProps {
  className: string,
  parent: () => HTMLElement | Window,
  children?: React.ReactNode,
  disableInlineStyles: boolean,
  disable: boolean,
  height: number,
  upTolerance: number,
  downTolerance: number,
  onPin: () => void,
  onUnpin: () => void,
  onUnfix: () => void,
  wrapperStyle: Record<string, AnyBecauseTodo>,
  pinStart: number,
  style?: Record<string, AnyBecauseTodo>,
  calcHeightOnResize: boolean,
}

export default class Headroom extends Component<HeadroomProps, AnyBecauseTodo> {
  static propTypes = {
    className: PropTypes.string,
    parent: PropTypes.func,
    children: PropTypes.any.isRequired,
    disableInlineStyles: PropTypes.bool,
    disable: PropTypes.bool,
    height: PropTypes.number,
    upTolerance: PropTypes.number,
    downTolerance: PropTypes.number,
    onPin: PropTypes.func,
    onUnpin: PropTypes.func,
    onUnfix: PropTypes.func,
    wrapperStyle: PropTypes.object,
    pinStart: PropTypes.number,
    style: PropTypes.object,
    calcHeightOnResize: PropTypes.bool,
  };

  static defaultProps = {
    parent: () => window,
    disableInlineStyles: false,
    disable: false,
    upTolerance: 5,
    downTolerance: 0,
    onPin: noop,
    onUnpin: noop,
    onUnfix: noop,
    wrapperStyle: {},
    pinStart: 0,
    calcHeightOnResize: true,
  };

  currentScrollY: number
  lastKnownScrollY: number
  scrollTicking: boolean
  resizeTicking: boolean
  inner: AnyBecauseTodo

  static getDerivedStateFromProps (props: { disable: AnyBecauseTodo }, state: { state: string }) {
    if (props.disable && state.state !== 'unfixed') {
      return {
        translateY: 0,
        className: 'headroom headroom--unfixed headroom-disable-animation',
        animation: false,
        state: 'unfixed',
      }
    }

    return null
  }

  constructor (props: AnyBecauseTodo) {
    super(props)
    // Class variables.
    this.currentScrollY = 0
    this.lastKnownScrollY = 0
    this.scrollTicking = false
    this.resizeTicking = false
    this.state = {
      state: 'unfixed',
      translateY: 0,
      className: 'headroom headroom--unfixed',
      height: props.height,
    }
  }

  componentDidMount () {
    this.setHeightOffset()
    if (!this.props.disable) {
      this.props.parent().addEventListener('scroll', this.handleScroll)

      if (this.props.calcHeightOnResize) {
        this.props.parent().addEventListener('resize', this.handleResize)
      }
    }
  }

  shouldComponentUpdate (nextProps: AnyBecauseTodo, nextState: AnyBecauseTodo) {
    return (
      !shallowequal(this.props, nextProps) ||
      !shallowequal(this.state, nextState)
    )
  }

  componentDidUpdate (prevProps: { children?: React.ReactNode; disable: boolean }, prevState: { state: string }) {
    // If children have changed, remeasure height.
    if (prevProps.children !== this.props.children) {
      this.setHeightOffset()
    }

    // Add/remove event listeners when re-enabled/disabled
    if (!prevProps.disable && this.props.disable) {
      this.props.parent().removeEventListener('scroll', this.handleScroll)
      this.props.parent().removeEventListener('resize', this.handleResize)

      if (prevState.state !== 'unfixed' && this.state.state === 'unfixed') {
        this.props.onUnfix()
      }
    } else if (prevProps.disable && !this.props.disable) {
      this.props.parent().addEventListener('scroll', this.handleScroll)

      if (this.props.calcHeightOnResize) {
        this.props.parent().addEventListener('resize', this.handleResize)
      }
    }
  }

  componentWillUnmount () {
    this.props.parent().removeEventListener('scroll', this.handleScroll)
    window.removeEventListener('scroll', this.handleScroll)
    this.props.parent().removeEventListener('resize', this.handleResize)
  }

  setRef = (ref: AnyBecauseTodo) => (this.inner = ref)

  setHeightOffset = () => {
    /*this.setState({
      height: this.inner ? this.inner.offsetHeight : '',
    })*/
    this.resizeTicking = false
  }

  getScrollY = () => {
    const parent = this.props.parent()
    if ('pageYOffset' in parent && parent.pageYOffset !== undefined) {
      return parent.pageYOffset
    } else if ('scrollTop' in parent && parent.scrollTop !== undefined) {
      return parent.scrollTop
    } else {
      return (document.documentElement || document.body.parentNode || document.body).scrollTop
    }
  }

  getViewportHeight = () => (
    window.innerHeight
      || document.documentElement.clientHeight
      || document.body.clientHeight
  )

  getDocumentHeight = () => {
    const body = document.body
    const documentElement = document.documentElement

    return Math.max(
      body.scrollHeight, documentElement.scrollHeight,
      body.offsetHeight, documentElement.offsetHeight,
      body.clientHeight, documentElement.clientHeight
    )
  }

  getElementPhysicalHeight = (elm: { offsetHeight: number; clientHeight: number }) => Math.max(
    elm.offsetHeight,
    elm.clientHeight
  )

  getElementHeight = (elm: { scrollHeight: number; offsetHeight: number; clientHeight: number }) => Math.max(
    elm.scrollHeight,
    elm.offsetHeight,
    elm.clientHeight,
  )

  getScrollerPhysicalHeight = () => {
    const parent = this.props.parent()

    return (parent === window || parent === document.body)
      ? this.getViewportHeight()
      : this.getElementPhysicalHeight(parent as HTMLElement)
  }

  getScrollerHeight = () => {
    const parent = this.props.parent()

    return (parent === window || parent === document.body)
      ? this.getDocumentHeight()
      : this.getElementHeight(parent as HTMLElement)
  }

  isOutOfBound = (currentScrollY: number) => {
    const pastTop = currentScrollY < 0

    const scrollerPhysicalHeight = this.getScrollerPhysicalHeight()
    const scrollerHeight = this.getScrollerHeight()

    const pastBottom = currentScrollY + scrollerPhysicalHeight > scrollerHeight

    return pastTop || pastBottom
  }

  handleScroll = () => {
    if (!this.scrollTicking) {
      this.scrollTicking = true
      raf(this.update)
    }
  }

  handleResize = () => {
    if (!this.resizeTicking) {
      this.resizeTicking = true
      raf(this.setHeightOffset)
    }
  }

  unpin = () => {
    this.props.onUnpin()

    this.setState({
      translateY: '-100%',
      className: 'headroom headroom--unpinned',
      animation: true,
      state: 'unpinned',
    })
  }

  unpinSnap = () => {
    this.props.onUnpin()

    this.setState({
      translateY: '-100%',
      className: 'headroom headroom--unpinned headroom-disable-animation',
      animation: false,
      state: 'unpinned',
    })
  }

  pin = () => {
    this.props.onPin()

    this.setState({
      translateY: 0,
      className: 'headroom headroom--pinned',
      animation: true,
      state: 'pinned',
    })
  }

  unfix = () => {
    this.props.onUnfix()

    this.setState({
      translateY: 0,
      className: 'headroom headroom--unfixed headroom-disable-animation',
      animation: false,
      state: 'unfixed',
    })
  }

  update = () => {
    this.currentScrollY = this.getScrollY()

    if (!this.isOutOfBound(this.currentScrollY)) {
      const { action } = shouldUpdate(
        this.lastKnownScrollY,
        this.currentScrollY,
        this.props,
        this.state 
      )

      if (action === 'pin') {
        this.pin()
      } else if (action === 'unpin') {
        this.unpin()
      } else if (action === 'unpin-snap') {
        this.unpinSnap()
      } else if (action === 'unfix') {
        this.unfix()
      }
    }

    this.lastKnownScrollY = this.currentScrollY
    this.scrollTicking = false
  }

  render () {
    // Type cast is necessary to prevent typescript from complaining about trying to delete readonly properties
    // This is vendored code and presumably has been working more or less fine the whole time
    const { className: userClassName, ...divProps } = this.props as AnyBecauseTodo
    delete divProps.onUnpin
    delete divProps.onPin
    delete divProps.onUnfix
    delete divProps.disableInlineStyles
    delete divProps.disable
    delete divProps.parent
    delete divProps.children
    delete divProps.height
    delete divProps.upTolerance
    delete divProps.downTolerance
    delete divProps.pinStart
    delete divProps.calcHeightOnResize

    const { style, wrapperStyle, ...rest } = divProps

    let innerStyle: CSSProperties = {
      position: this.props.disable || this.state.state === 'unfixed' ? 'relative' : 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1,
      WebkitTransform: `translate3D(0, ${this.state.translateY}, 0)`,
      msTransform: `translate3D(0, ${this.state.translateY}, 0)`,
      transform: `translate3D(0, ${this.state.translateY}, 0)`,
    }

    let className = this.state.className

    // Don't add css transitions until after we've done the initial
    // negative transform when transitioning from 'unfixed' to 'unpinned'.
    // If we don't do this, the header will flash into view temporarily
    // while it transitions from 0 — -100%.
    if (this.state.animation) {
      innerStyle = {
        ...innerStyle,
        WebkitTransition: 'all .2s ease-in-out',
        MozTransition: 'all .2s ease-in-out',
        OTransition: 'all .2s ease-in-out',
        transition: 'all .2s ease-in-out',
      }
      className += ' headroom--scrolled'
    }

    if (!this.props.disableInlineStyles) {
      innerStyle = {
        ...innerStyle,
        ...style,
      }
    } else {
      innerStyle = style
    }

    const wrapperStyles = {
      ...wrapperStyle,
      height: this.state.height ? this.state.height : null,
    }

    const wrapperClassName = userClassName
      ? `${userClassName} headroom-wrapper`
      : 'headroom-wrapper'

    return (
      <div style={wrapperStyles} className={wrapperClassName}>
        <div
          ref={this.setRef}
          {...rest}
          style={innerStyle}
          className={className}
        >
          {this.props.children}
        </div>
      </div>
    )
  }
}
