'use client'

import BibleTab from '@/components/control/BibleTab'
import CaptionsTab from '@/components/control/CaptionsTab'
import ControlHeader from '@/components/control/ControlHeader'
import ControlLiveStrip from '@/components/control/ControlLiveStrip'
import ControlTabBar from '@/components/control/ControlTabBar'
import ControlToast from '@/components/control/ControlToast'
import ImagesTab from '@/components/control/ImagesTab'
import MediaTab from '@/components/control/MediaTab'
import NoticesTab from '@/components/control/NoticesTab'
import ShortcutHelpModal from '@/components/control/ShortcutHelpModal'
import SongsTab from '@/components/control/SongsTab'
import TimerTab from '@/components/control/TimerTab'
import { controlPageStyles as s } from '@/components/control/controlPageStyles'
import { useControlPageController } from '@/components/control/useControlPageController'

export default function ControlPanel() {
  const control = useControlPageController()

  return (
    <div style={s.page}>
      <div style={s.pageGlowPrimary} />
      <div style={s.pageGlowSecondary} />
      <div style={s.pageGrid} />

      <ControlHeader styles={s} {...control.headerProps} />
      <ControlTabBar styles={s} {...control.tabBarProps} />
      {control.activeTab !== 'bible' && (
        <ControlLiveStrip styles={s} {...control.liveStripProps} />
      )}

      <div style={s.content}>
        {control.activeTab === 'timer' && (
          <TimerTab styles={s} {...control.timerTabProps} />
        )}

        {control.activeTab === 'bible' && (
          <BibleTab styles={s} {...control.bibleTabProps} />
        )}

        {control.activeTab === 'captions' && (
          <CaptionsTab styles={s} {...control.captionsTabProps} />
        )}

        {control.activeTab === 'songs' && (
          <SongsTab styles={s} {...control.songsTabProps} />
        )}

        {control.activeTab === 'images' && (
          <ImagesTab styles={s} {...control.imagesTabProps} />
        )}

        {control.activeTab === 'media' && (
          <MediaTab styles={s} {...control.mediaTabProps} />
        )}

        {control.activeTab === 'notices' && (
          <NoticesTab styles={s} {...control.noticesTabProps} />
        )}
      </div>

      {control.toast && (
        <ControlToast
          styles={s}
          toast={control.toast}
          onUndo={control.handleToastUndo}
          onDismiss={control.dismissToast}
        />
      )}

      {control.showShortcutHelp && (
        <ShortcutHelpModal
          styles={s}
          shortcuts={control.shortcuts}
          onClose={control.closeShortcutHelp}
        />
      )}
    </div>
  )
}
