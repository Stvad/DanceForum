import React, {useCallback, useState} from 'react'
import {Components, registerComponent} from '../../lib/vulcan-lib'
import {useEAOnboarding} from '../ea-forum/onboarding/useEAOnboarding'
import {styles as inputStyles} from '../ea-forum/onboarding/EAOnboardingInput'
import {useCurrentUser} from '../common/withUser'


const styles = (theme: ThemeType) => ({
  root: {
    marginBottom: 10,
    '& .LocationPicker-root .geosuggest__input': {
      ...inputStyles(theme).root,
    },
    '& .LocationPicker-root .geosuggest__input:focus': {
      borderBottom: 'unset',
      borderBottomColor: 'unset',
    },
    '& .geosuggest': {
      padding: 0,
    },
  },
  title: {
    fontSize: 12,
  },
  footer: {
    textAlign: 'center',
  },
  footerButton: {
    width: '100%',
    maxWidth: 500,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
  },
  secondaryText: {
    color: theme.palette.grey[600],
    fontSize: 13,
    marginTop: '0.5em',
  },
})

export const DFAdditionalInfoStage = ({classes}: {
  classes: ClassesType<typeof styles>,
}) => {
  const {updateCurrentUser, goToNextStage, goToNextStageAfter, viewAsAdmin} = useEAOnboarding()
  const [wsdcNumber, setWsdcNumber] = useState('')
  const [mapLocation, setMapLocation] = useState(null)
  const currentUser = useCurrentUser()

  const onContinue = useCallback(async () => {
    // If this is an admin testing, don't make any changes
    if (viewAsAdmin) {
      await goToNextStage()
      return
    }

    await goToNextStageAfter(
      updateCurrentUser({
        wsdcNumber: parseInt(wsdcNumber) || undefined,
        mapLocation,
      }),
    )
  }, [wsdcNumber, mapLocation, updateCurrentUser, goToNextStage, goToNextStageAfter, viewAsAdmin])

  const onWsdcNumberChange = (newNumber: string) => {
    const isNumber = /^[0-9]*$/.test(newNumber)
    if (isNumber) {
      setWsdcNumber(newNumber)
    }
  }

  const {
    EAOnboardingStage,
    EAOnboardingInput,
    EAButton,
    SectionTitle,
    LocationPicker,
    EAUsersProfileImage,
  } = Components
  
  return (
    <EAOnboardingStage
      stageName="additionalInfo"
      title="Additional Information"
      onContinue={onContinue}
      footer={
        <div className={classes.footer}>
          <EAButton onClick={onContinue} className={classes.footerButton}>
            Go to the Forum -&gt;
          </EAButton>
        </div>
      }
      icon={null}
      hideFooterButton
      className={classes.root}
    >
      <div>
        Share some additional information to improve you forum experience (optional)
      </div>
      <div>
        <SectionTitle title="Profile Image" className={classes.title}/>
        <EAUsersProfileImage user={currentUser!}/>
      </div>
      <div>
        <SectionTitle title="City" className={classes.title}/>
        <LocationPicker
          document={{}}
          path={'mapLocation'}
          value={mapLocation}
          updateCurrentValues={(it: any) => {
            setMapLocation(it['mapLocation'])
          }}
          locationTypes={['(cities)']}
        />
        <div className={classes.secondaryText}>
          This is used to suggest you the events happening nearby.
        </div>
      </div>
      <div>
        <SectionTitle title="WSDC number" className={classes.title}/>
        <EAOnboardingInput
          value={wsdcNumber}
          setValue={onWsdcNumberChange}
          placeholder="e.g. 12345"
        />
      </div>
    </EAOnboardingStage>
  )
}

const DFAdditionalInfoStageComponent = registerComponent(
  'DFAdditionalInfoStage',
  DFAdditionalInfoStage,
  {styles},
)

declare global {
  interface ComponentTypes {
    DFAdditionalInfoStage: typeof DFAdditionalInfoStageComponent
  }
}
