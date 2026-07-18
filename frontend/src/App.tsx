import { useState } from 'react'

import LessonBriefPage from './pages/LessonBriefPage'
import OutlineEditorPage from './pages/OutlineEditorPage'
import PresentationEditorPage from './pages/PresentationEditorPage'
import PresentationModePage from './pages/PresentationModePage'
import type {
  LessonBrief,
  Presentation,
  PresentationOutline,
} from './types/presentation'
import './App.css'

function App() {
  const [view, setView] = useState<
    'brief' | 'outline' | 'presentation' | 'present-mode'
  >('brief')
  const [brief, setBrief] = useState<LessonBrief>({
    prompt: '',
    duration_minutes: 15,
  })
  const [outline, setOutline] = useState<PresentationOutline | null>(null)
  const [presentation, setPresentation] = useState<Presentation | null>(null)

  function handleOutlineGenerated(
    generatedOutline: PresentationOutline,
    submittedBrief: LessonBrief,
  ) {
    setBrief(submittedBrief)
    setOutline(generatedOutline)
    setView('outline')
  }

  function handleOutlineRegenerated(
    nextBrief: LessonBrief,
    nextOutline: PresentationOutline,
  ) {
    setBrief(nextBrief)
    setOutline(nextOutline)
  }

  function handlePresentationGenerated(nextPresentation: Presentation) {
    setPresentation(nextPresentation)
    setView('presentation')
  }

  if (view === 'brief' || !outline) {
    return (
      <LessonBriefPage
        initialBrief={brief}
        onOutlineGenerated={handleOutlineGenerated}
      />
    )
  }

  if (view === 'present-mode' && presentation) {
    return (
      <PresentationModePage
        presentation={presentation}
        onExit={() => setView('presentation')}
      />
    )
  }

  if (view === 'presentation' && presentation) {
    return (
      <PresentationEditorPage
        presentation={presentation}
        onPresentationChange={setPresentation}
        onBack={() => setView('outline')}
        onPresent={() => setView('present-mode')}
      />
    )
  }

  return (
    <OutlineEditorPage
      brief={brief}
      outline={outline}
      onOutlineChange={setOutline}
      onOutlineRegenerated={handleOutlineRegenerated}
      onPresentationGenerated={handlePresentationGenerated}
      onBack={() => setView('brief')}
    />
  )
}

export default App
