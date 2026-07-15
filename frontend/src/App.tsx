import { useState } from 'react'

import LessonBriefPage from './pages/LessonBriefPage'
import type { LessonBrief, PresentationOutline } from './types/presentation'
import './App.css'

function App() {
  const [brief, setBrief] = useState<LessonBrief>({
    prompt: '',
    duration_minutes: 15,
  })
  const [outline, setOutline] = useState<PresentationOutline | null>(null)

  function handleOutlineGenerated(
    generatedOutline: PresentationOutline,
    submittedBrief: LessonBrief,
  ) {
    setBrief(submittedBrief)
    setOutline(generatedOutline)
  }

  if (!outline) {
    return (
      <LessonBriefPage
        initialBrief={brief}
        onOutlineGenerated={handleOutlineGenerated}
      />
    )
  }

  return (
    <main className="outline-placeholder">
      <section>
        <p className="outline-placeholder-label">Outline generated</p>
        <h1>{outline.title}</h1>
        <p>
          {outline.slides.length}{' '}
          {outline.slides.length === 1 ? 'slide' : 'slides'}
        </p>
        <button type="button" onClick={() => setOutline(null)}>
          Back
        </button>
      </section>
    </main>
  )
}

export default App
