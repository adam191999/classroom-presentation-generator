import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'

import { generateOutline } from '../services/api'
import type {
  DurationMinutes,
  LessonBrief,
  PresentationOutline,
} from '../types/presentation'
import './LessonBriefPage.css'

interface LessonBriefPageProps {
  initialBrief: LessonBrief
  onOutlineGenerated: (
    outline: PresentationOutline,
    submittedBrief: LessonBrief,
  ) => void
}

function resizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return
  }

  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}

function LessonBriefPage({
  initialBrief,
  onOutlineGenerated,
}: LessonBriefPageProps) {
  const [prompt, setPrompt] = useState(initialBrief.prompt)
  const [durationMinutes, setDurationMinutes] =
    useState<DurationMinutes>(initialBrief.duration_minutes)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isPromptValid = prompt.trim().length >= 10

  useEffect(() => {
    resizeTextarea(textareaRef.current)
  }, [])

  function handlePromptChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget
    setPrompt(textarea.value)
    resizeTextarea(textarea)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isPromptValid || isLoading) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const submittedBrief: LessonBrief = {
        prompt: prompt.trim(),
        duration_minutes: durationMinutes,
      }
      const outline = await generateOutline(submittedBrief)
      onOutlineGenerated(outline, submittedBrief)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to generate an outline. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="lesson-brief-page">
      <section className="lesson-brief-panel">
        <h1>What would you like to teach?</h1>

        <form className="lesson-brief-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="lesson-prompt">
            Lesson description
          </label>
          <textarea
            ref={textareaRef}
            id="lesson-prompt"
            value={prompt}
            onChange={handlePromptChange}
            placeholder="Describe what you want to teach, including the learning focus and any important context"
            maxLength={2000}
            rows={5}
          />

          <div className="lesson-brief-actions">
            <label className="duration-field" htmlFor="duration-minutes">
              <span>Duration</span>
              <select
                id="duration-minutes"
                value={durationMinutes}
                onChange={(event) =>
                  setDurationMinutes(
                    Number(event.target.value) as DurationMinutes,
                  )
                }
              >
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
              </select>
            </label>

            <button type="submit" disabled={!isPromptValid || isLoading}>
              {isLoading ? 'Generating outline...' : 'Generate Outline'}
            </button>
          </div>

          {error && (
            <p className="lesson-brief-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  )
}

export default LessonBriefPage
