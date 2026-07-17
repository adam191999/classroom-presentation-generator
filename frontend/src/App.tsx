import { useState } from 'react'

import LessonBriefPage from './pages/LessonBriefPage'
import OutlineEditorPage from './pages/OutlineEditorPage'
import type {
  LessonBrief,
  Presentation,
  PresentationOutline,
} from './types/presentation'
import './App.css'

function App() {
  const [view, setView] = useState<'brief' | 'outline' | 'presentation'>(
    'brief',
  )
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

  if (view === 'presentation' && presentation) {
    return (
      <main className="outline-placeholder">
        <section>
          <p className="outline-placeholder-label">Presentation generated</p>
          <h1>{presentation.title}</h1>
          <p>
            {presentation.slides.length}{' '}
            {presentation.slides.length === 1 ? 'slide' : 'slides'}
          </p>
          <button type="button" onClick={() => setView('outline')}>
            Back to outline
          </button>
        </section>
      </main>
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
