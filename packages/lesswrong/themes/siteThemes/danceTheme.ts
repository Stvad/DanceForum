import {eaForumTheme} from './eaTheme.ts'

export const danceForumTheme: SiteThemeSpecification = {
  ...eaForumTheme,
  make: (palette: ThemePalette) => {
    const eaForum = eaForumTheme.make!(palette)
    return {
      ...eaForum,
      overrides: {
        ...eaForum.overrides,
        EAOnboardingStage: {
          scrollable: {
            overflowY: 'auto',
          },
        },
        LocalGroupsItem: {
          // todo default causes text to cut off in the friendly ui mode for some reason
          title: {
            lineHeight: 'unset',
          },
          links: {
            // 🤔 this is obviously good if we have same number of links, but unclear for the case of varied number of flairs and links
            display: 'flex',
            justifyContent: 'flex-end',
          },
        },
        EAUsersProfileImage: {
          hoverOver: {
            borderRadius: 6,
          },
        },
        UsersProfileImage: {
          root: {
            borderRadius: 6,
          },
        },
        EALoginPopover: {
          lightbulb: {
            display: 'none',
          },
        },
        TagPageButtonRow: {
          buttonsRow: {
            marginTop: '0.5em',
          }
        },
        PopupCommentEditor: {
          editor: {
            '& .EditorFormComponent-maxHeight': {
              overflowY: 'auto',
            },
          },
        },
      },
    }
  },
}
