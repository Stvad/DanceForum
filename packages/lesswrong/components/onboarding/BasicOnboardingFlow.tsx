import React from 'react'
import {Components, registerComponent} from '../../lib/vulcan-lib'

const BasicOnboardingFlow = ({viewAsAdmin}: { viewAsAdmin?: boolean }) => <Components.OnboardingFlow
  viewAsAdmin={viewAsAdmin}
  stages={{
    user: <Components.EAOnboardingUserStage icon={null}/>,
    additionalInfo: <Components.DFAdditionalInfoStage/>,
  }}/>

const BasicOnboardingFlowComponent = registerComponent(
  'BasicOnboardingFlow',
  BasicOnboardingFlow,
)

declare global {
  interface ComponentTypes {
    BasicOnboardingFlow: typeof BasicOnboardingFlowComponent
  }
}
