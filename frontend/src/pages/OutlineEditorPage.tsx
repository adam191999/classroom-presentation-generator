import { useEffect, useState, type DragEvent } from 'react'

import { generateOutline, generatePresentation } from '../services/api'
import type {
  DurationMinutes,
  LessonBrief,
  OutlineSlide,
  Presentation,
  PresentationOutline,
  SlideType,
} from '../types/presentation'
import './OutlineEditorPage.css'

interface OutlineEditorPageProps {
  brief: LessonBrief
  outline: PresentationOutline
  onOutlineChange: (outline: PresentationOutline) => void
  onOutlineRegenerated: (
    brief: LessonBrief,
    outline: PresentationOutline,
  ) => void
  onPresentationGenerated: (presentation: Presentation) => void
  onBack: () => void
}

const slideTypeOptions: { value: SlideType; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'content', label: 'Content' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'summary', label: 'Summary' },
]

type DropPosition = 'before' | 'after'

function getOutlineValidationError(
  outline: PresentationOutline,
): string | null {
  if (!outline.title.trim()) {
    return 'The outline title is missing.'
  }

  if (!outline.learning_objective.trim()) {
    return 'The learning objective is missing.'
  }

  if (outline.slides.length === 0) {
    return 'Add at least one slide before generating a presentation.'
  }

  for (let index = 0; index < outline.slides.length; index += 1) {
    const slide = outline.slides[index]
    const slideLabel = `Slide ${index + 1}`

    if (!slide.title.trim()) {
      return `${slideLabel} needs a non-empty title.`
    }

    if (
      slide.content_summary.length < 1 ||
      slide.content_summary.length > 5
    ) {
      return `${slideLabel} must have between 1 and 5 content summary items.`
    }

    if (slide.content_summary.some((item) => !item.trim())) {
      return `${slideLabel} has an empty content summary line.`
    }
  }

  return null
}

function normalizeOutline(outline: PresentationOutline): PresentationOutline {
  return {
    ...outline,
    title: outline.title.trim(),
    learning_objective: outline.learning_objective.trim(),
    slides: outline.slides.map((slide) => ({
      ...slide,
      title: slide.title.trim(),
      content_summary: slide.content_summary.map((item) => item.trim()),
    })),
  }
}

function OutlineEditorPage({
  brief,
  outline,
  onOutlineChange,
  onOutlineRegenerated,
  onPresentationGenerated,
  onBack,
}: OutlineEditorPageProps) {
  const [draftPrompt, setDraftPrompt] = useState(brief.prompt)
  const [draftDuration, setDraftDuration] = useState<DurationMinutes>(
    brief.duration_minutes,
  )
  const [isConfirmingRegenerate, setIsConfirmingRegenerate] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isGeneratingPresentation, setIsGeneratingPresentation] =
    useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [insertAfterSlideId, setInsertAfterSlideId] = useState<string | null>(
    null,
  )
  const [newSlideType, setNewSlideType] = useState<SlideType>('content')
  const [newSlideTitle, setNewSlideTitle] = useState('')
  const [newSlideDescription, setNewSlideDescription] = useState('')

  const trimmedNewTitle = newSlideTitle.trim()
  const trimmedNewDescription = newSlideDescription.trim()
  const canAddSlide =
    trimmedNewTitle.length > 0 && trimmedNewDescription.length >= 10

  const trimmedDraftPrompt = draftPrompt.trim()
  const draftDiffers =
    trimmedDraftPrompt !== brief.prompt ||
    draftDuration !== brief.duration_minutes
  const isRequestRunning = isRegenerating || isGeneratingPresentation
  const canUpdateOutline =
    draftDiffers && trimmedDraftPrompt.length >= 10 && !isRequestRunning

  const validationError = getOutlineValidationError(outline)
  const canGeneratePresentation =
    validationError === null && !isRequestRunning

  useEffect(() => {
    if (!insertAfterSlideId && !isConfirmingRegenerate) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || isRegenerating) {
        return
      }

      if (insertAfterSlideId) {
        closeAddSlideModal()
        return
      }

      setIsConfirmingRegenerate(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [insertAfterSlideId, isConfirmingRegenerate, isRegenerating])

  function clearDragState() {
    setDraggedSlideId(null)
    setDropTargetId(null)
    setDropPosition(null)
  }

  function updateSlide(slideId: string, changes: Partial<OutlineSlide>) {
    onOutlineChange({
      ...outline,
      slides: outline.slides.map((slide) =>
        slide.id === slideId ? { ...slide, ...changes } : slide,
      ),
    })
  }

  function handleDragStart(
    event: DragEvent<HTMLElement>,
    slideId: string,
  ) {
    setDraggedSlideId(slideId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', slideId)

    const dragImage = document.createElement('canvas')
    dragImage.width = 1
    dragImage.height = 1
    event.dataTransfer.setDragImage(dragImage, 0, 0)
  }

  function handleDragOver(
    event: DragEvent<HTMLElement>,
    targetSlideId: string,
  ) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    if (!draggedSlideId || draggedSlideId === targetSlideId) {
      setDropTargetId(null)
      setDropPosition(null)
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const midpoint = bounds.top + bounds.height / 2
    const position: DropPosition =
      event.clientY < midpoint ? 'before' : 'after'

    setDropTargetId(targetSlideId)
    setDropPosition(position)
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetSlideId: string) {
    event.preventDefault()

    const sourceSlideId =
      event.dataTransfer.getData('text/plain') || draggedSlideId
    const insertionPosition = dropPosition

    clearDragState()

    if (!sourceSlideId || !insertionPosition || sourceSlideId === targetSlideId) {
      return
    }

    const sourceIndex = outline.slides.findIndex(
      (slide) => slide.id === sourceSlideId,
    )

    if (sourceIndex === -1) {
      return
    }

    const remainingSlides = outline.slides.filter(
      (slide) => slide.id !== sourceSlideId,
    )
    const targetIndex = remainingSlides.findIndex(
      (slide) => slide.id === targetSlideId,
    )

    if (targetIndex === -1) {
      return
    }

    const insertIndex =
      insertionPosition === 'before' ? targetIndex : targetIndex + 1
    const reorderedSlides = [...remainingSlides]
    reorderedSlides.splice(insertIndex, 0, outline.slides[sourceIndex])

    onOutlineChange({ ...outline, slides: reorderedSlides })
  }

  function deleteSlide(slideId: string) {
    if (outline.slides.length === 1) {
      return
    }

    onOutlineChange({
      ...outline,
      slides: outline.slides.filter((slide) => slide.id !== slideId),
    })
    setOpenMenuId(null)
  }

  function openAddSlideModal(slideId: string) {
    setOpenMenuId(null)
    setInsertAfterSlideId(slideId)
    setNewSlideType('content')
    setNewSlideTitle('')
    setNewSlideDescription('')
  }

  function closeAddSlideModal() {
    setInsertAfterSlideId(null)
    setNewSlideType('content')
    setNewSlideTitle('')
    setNewSlideDescription('')
  }

  function addSlideBelow() {
    if (!insertAfterSlideId || !canAddSlide) {
      return
    }

    const insertIndex = outline.slides.findIndex(
      (slide) => slide.id === insertAfterSlideId,
    )

    if (insertIndex === -1) {
      closeAddSlideModal()
      return
    }

    const newSlide: OutlineSlide = {
      id: crypto.randomUUID(),
      type: newSlideType,
      title: trimmedNewTitle,
      content_summary: [trimmedNewDescription],
    }

    const newSlides = [...outline.slides]
    newSlides.splice(insertIndex + 1, 0, newSlide)

    onOutlineChange({ ...outline, slides: newSlides })
    closeAddSlideModal()
  }

  async function confirmRegenerate() {
    if (trimmedDraftPrompt.length < 10 || isRegenerating) {
      return
    }

    const nextBrief: LessonBrief = {
      prompt: trimmedDraftPrompt,
      duration_minutes: draftDuration,
    }

    setIsRegenerating(true)
    setError(null)

    try {
      const nextOutline = await generateOutline(nextBrief)
      setDraftPrompt(nextBrief.prompt)
      setDraftDuration(nextBrief.duration_minutes)
      onOutlineRegenerated(nextBrief, nextOutline)
      setIsConfirmingRegenerate(false)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to regenerate the outline. Please try again.',
      )
    } finally {
      setIsRegenerating(false)
    }
  }

  async function handleGeneratePresentation() {
    if (!canGeneratePresentation) {
      return
    }

    setIsGeneratingPresentation(true)
    setError(null)

    try {
      const presentation = await generatePresentation(normalizeOutline(outline))
      onPresentationGenerated(presentation)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to generate the presentation. Please try again.',
      )
    } finally {
      setIsGeneratingPresentation(false)
    }
  }

  return (
    <main className="outline-editor-page">
      <div className="outline-editor-content">
        <header className="outline-editor-header">
          <button className="outline-back-button" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span> Back
          </button>
          <div className="outline-editor-heading">
            <h1>Lesson Outline</h1>
            <p>
              Review and adjust the lesson structure before generating the full
              presentation.
            </p>
          </div>
        </header>

        <section className="brief-editor" aria-label="Lesson brief">
          <label>
            <span>Lesson prompt</span>
            <textarea
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
              maxLength={2000}
              rows={4}
            />
          </label>

          <div className="brief-editor-actions">
            <label className="brief-duration-field" htmlFor="brief-duration">
              <span>Duration</span>
              <select
                id="brief-duration"
                value={draftDuration}
                onChange={(event) =>
                  setDraftDuration(
                    Number(event.target.value) as DurationMinutes,
                  )
                }
              >
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
              </select>
            </label>

            <button
              type="button"
              className="update-outline-button"
              disabled={!canUpdateOutline}
              onClick={() => {
                setError(null)
                setIsConfirmingRegenerate(true)
              }}
            >
              Update Outline
            </button>
          </div>
        </section>

        <section className="outline-slide-list" aria-label="Outline slides">
          {outline.slides.map((slide, index) => {
            const isMenuOpen = openMenuId === slide.id
            const cardClasses = [
              'outline-slide-card',
              draggedSlideId === slide.id ? 'is-dragging' : '',
              dropTargetId === slide.id && dropPosition === 'before'
                ? 'drop-before'
                : '',
              dropTargetId === slide.id && dropPosition === 'after'
                ? 'drop-after'
                : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <article
                className={cardClasses}
                key={slide.id}
                onDragOver={(event) => handleDragOver(event, slide.id)}
                onDrop={(event) => handleDrop(event, slide.id)}
              >
                <div className="slide-card-header">
                  <div className="slide-position">
                    <button
                      type="button"
                      className="drag-handle"
                      draggable={true}
                      aria-label={`Drag slide ${index + 1} to reorder`}
                      title="Drag to reorder"
                      onDragStart={(event) =>
                        handleDragStart(event, slide.id)
                      }
                      onDragEnd={clearDragState}
                    >
                      ⋮⋮
                    </button>
                    <span className="slide-number">Slide {index + 1}</span>
                  </div>

                  <div className="slide-menu">
                    <button
                      className="slide-menu-button"
                      type="button"
                      aria-label={`Open menu for slide ${index + 1}`}
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                      onClick={() =>
                        setOpenMenuId(isMenuOpen ? null : slide.id)
                      }
                    >
                      <span aria-hidden="true">•••</span>
                    </button>
                    {isMenuOpen && (
                      <div className="slide-menu-popover" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="slide-menu-add"
                          onClick={() => openAddSlideModal(slide.id)}
                        >
                          Add slide below
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="slide-menu-delete"
                          disabled={outline.slides.length === 1}
                          onClick={() => deleteSlide(slide.id)}
                        >
                          Delete slide
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="slide-card-fields">
                  <label>
                    <span>Slide type</span>
                    <select
                      value={slide.type}
                      onChange={(event) =>
                        updateSlide(slide.id, {
                          type: event.target.value as SlideType,
                        })
                      }
                    >
                      {slideTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Title</span>
                    <input
                      value={slide.title}
                      onChange={(event) =>
                        updateSlide(slide.id, { title: event.target.value })
                      }
                    />
                  </label>

                  <label className="summary-field">
                    <span>Content summary</span>
                    <textarea
                      value={slide.content_summary.join('\n')}
                      onChange={(event) =>
                        updateSlide(slide.id, {
                          content_summary: event.target.value.split('\n'),
                        })
                      }
                      rows={Math.max(2, slide.content_summary.length)}
                    />
                  </label>
                </div>
              </article>
            )
          })}
        </section>

        <div className="presentation-actions">
          {validationError && (
            <p className="outline-validation-message" role="status">
              {validationError}
            </p>
          )}
          {error && (
            <p className="outline-editor-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="generate-presentation-button"
            disabled={!canGeneratePresentation}
            onClick={handleGeneratePresentation}
          >
            {isGeneratingPresentation
              ? 'Generating presentation...'
              : 'Generate Presentation'}
          </button>
        </div>
      </div>

      {insertAfterSlideId && (
        <div className="add-slide-modal-backdrop">
          <div
            className="add-slide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-slide-modal-title"
          >
            <h2 id="add-slide-modal-title">Add slide below</h2>

            <form
              className="add-slide-modal-form"
              onSubmit={(event) => {
                event.preventDefault()
                addSlideBelow()
              }}
            >
              <label>
                <span>Slide type</span>
                <select
                  value={newSlideType}
                  onChange={(event) =>
                    setNewSlideType(event.target.value as SlideType)
                  }
                >
                  {slideTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Title</span>
                <input
                  value={newSlideTitle}
                  onChange={(event) => setNewSlideTitle(event.target.value)}
                  autoFocus
                />
              </label>

              <label>
                <span>Content description</span>
                <textarea
                  value={newSlideDescription}
                  onChange={(event) =>
                    setNewSlideDescription(event.target.value)
                  }
                  maxLength={500}
                  rows={4}
                />
              </label>

              <div className="add-slide-modal-actions">
                <button
                  type="button"
                  className="add-slide-cancel"
                  onClick={closeAddSlideModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="add-slide-submit"
                  disabled={!canAddSlide}
                >
                  Add slide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isConfirmingRegenerate && (
        <div className="add-slide-modal-backdrop">
          <div
            className="regenerate-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="regenerate-confirm-title"
          >
            <h2 id="regenerate-confirm-title">Update outline?</h2>
            <p>
              Regenerating will replace the current outline and discard its
              edits.
            </p>
            <div className="add-slide-modal-actions">
              <button
                type="button"
                className="add-slide-cancel"
                disabled={isRegenerating}
                onClick={() => setIsConfirmingRegenerate(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="add-slide-submit"
                disabled={isRegenerating}
                onClick={confirmRegenerate}
              >
                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default OutlineEditorPage
