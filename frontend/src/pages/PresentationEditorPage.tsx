import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'

import { generateSlide } from '../services/api'
import type {
  ContentSlide,
  DiscussionSlide,
  MultipleChoiceSlide,
  Presentation,
  PresentationSlide,
  SlideType,
  SummarySlide,
  TitleSlide,
} from '../types/presentation'
import './PresentationEditorPage.css'

interface PresentationEditorPageProps {
  presentation: Presentation
  onPresentationChange: (presentation: Presentation) => void
  onBack: () => void
}

type DropPosition = 'before' | 'after'

const slideTypeOptions: { value: SlideType; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'content', label: 'Content' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'summary', label: 'Summary' },
]

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0
}

function fieldClass(base: string, value: string): string {
  return isBlank(value) ? `${base} is-empty` : base
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto'
  textarea.style.height = `${textarea.scrollHeight}px`
}

function SlideTextInput({
  className,
  value,
  onChange,
  ariaLabel,
  multiline = false,
  rows = 2,
}: {
  className: string
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  multiline?: boolean
  rows?: number
}) {
  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    onChange(event.target.value)
    if (event.target instanceof HTMLTextAreaElement) {
      resizeTextarea(event.target)
    }
  }

  if (multiline) {
    return (
      <textarea
        className={className}
        value={value}
        aria-label={ariaLabel}
        rows={rows}
        onChange={handleChange}
        ref={(element) => {
          if (element) {
            resizeTextarea(element)
          }
        }}
      />
    )
  }

  return (
    <input
      className={className}
      type="text"
      value={value}
      aria-label={ariaLabel}
      onChange={handleChange}
    />
  )
}

function ImageArea({
  imageUrl,
  alt,
}: {
  imageUrl?: string | null
  alt: string
}) {
  if (imageUrl) {
    return (
      <div className="slide-image-frame">
        <img src={imageUrl} alt={alt} className="slide-image" />
      </div>
    )
  }

  return (
    <div className="slide-image-placeholder" aria-hidden="true">
      <span>Image placeholder</span>
    </div>
  )
}

function TitleSlideView({
  slide,
  onChange,
}: {
  slide: TitleSlide
  onChange: (changes: Partial<TitleSlide>) => void
}) {
  return (
    <div className="slide-view slide-view-title">
      <div className="slide-view-copy">
        <SlideTextInput
          className={fieldClass('slide-title-input', slide.title)}
          value={slide.title}
          ariaLabel="Slide title"
          onChange={(title) => onChange({ title })}
        />
        <SlideTextInput
          className="slide-subtitle-input"
          value={slide.subtitle ?? ''}
          ariaLabel="Slide subtitle"
          multiline
          rows={2}
          onChange={(subtitle) => onChange({ subtitle })}
        />
      </div>
      <ImageArea imageUrl={slide.image_url} alt={slide.title} />
    </div>
  )
}

function ContentSlideView({
  slide,
  onChange,
}: {
  slide: ContentSlide
  onChange: (changes: Partial<ContentSlide>) => void
}) {
  function updateBullet(index: number, value: string) {
    onChange({
      bullet_points: slide.bullet_points.map((point, pointIndex) =>
        pointIndex === index ? value : point,
      ),
    })
  }

  return (
    <div className="slide-view slide-view-content">
      <div className="slide-view-copy">
        <SlideTextInput
          className={fieldClass('slide-title-input', slide.title)}
          value={slide.title}
          ariaLabel="Slide title"
          onChange={(title) => onChange({ title })}
        />
        <SlideTextInput
          className={fieldClass('slide-body-input', slide.body)}
          value={slide.body}
          ariaLabel="Slide body"
          multiline
          rows={3}
          onChange={(body) => onChange({ body })}
        />
        <ul className="slide-bullets slide-bullets-editable">
          {slide.bullet_points.map((point, index) => (
            <li key={`bullet-${index}`}>
              <SlideTextInput
                className={fieldClass('slide-list-input', point)}
                value={point}
                ariaLabel={`Bullet point ${index + 1}`}
                multiline
                rows={1}
                onChange={(value) => updateBullet(index, value)}
              />
            </li>
          ))}
        </ul>
      </div>
      <ImageArea imageUrl={slide.image_url} alt={slide.title} />
    </div>
  )
}

function DiscussionSlideView({
  slide,
  onChange,
}: {
  slide: DiscussionSlide
  onChange: (changes: Partial<DiscussionSlide>) => void
}) {
  return (
    <div className="slide-view slide-view-discussion">
      <SlideTextInput
        className={fieldClass('slide-title-input', slide.title)}
        value={slide.title}
        ariaLabel="Slide title"
        onChange={(title) => onChange({ title })}
      />
      <SlideTextInput
        className={fieldClass('slide-question-input', slide.question)}
        value={slide.question}
        ariaLabel="Discussion question"
        multiline
        rows={2}
        onChange={(question) => onChange({ question })}
      />
      <div className="teacher-prompt">
        <span className="teacher-prompt-label">Teacher prompt</span>
        <SlideTextInput
          className={fieldClass('slide-prompt-input', slide.teacher_prompt)}
          value={slide.teacher_prompt}
          ariaLabel="Teacher prompt"
          multiline
          rows={3}
          onChange={(teacher_prompt) => onChange({ teacher_prompt })}
        />
      </div>
    </div>
  )
}

function MultipleChoiceSlideView({
  slide,
  onChange,
}: {
  slide: MultipleChoiceSlide
  onChange: (changes: Partial<MultipleChoiceSlide>) => void
}) {
  function updateOption(index: number, value: string) {
    onChange({
      options: slide.options.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    })
  }

  return (
    <div className="slide-view slide-view-multiple-choice">
      <SlideTextInput
        className={fieldClass('slide-title-input', slide.title)}
        value={slide.title}
        ariaLabel="Slide title"
        onChange={(title) => onChange({ title })}
      />
      <SlideTextInput
        className={fieldClass('slide-question-input', slide.question)}
        value={slide.question}
        ariaLabel="Question"
        multiline
        rows={2}
        onChange={(question) => onChange({ question })}
      />
      <ul className="slide-options">
        {slide.options.map((option, index) => {
          const isCorrect = index === slide.correct_option

          return (
            <li
              key={`option-${index}`}
              className={isCorrect ? 'is-correct' : undefined}
            >
              <button
                type="button"
                className="option-marker option-correct-toggle"
                aria-label={`Mark option ${String.fromCharCode(65 + index)} as correct`}
                aria-pressed={isCorrect}
                onClick={() => onChange({ correct_option: index })}
              >
                {String.fromCharCode(65 + index)}
              </button>
              <SlideTextInput
                className={fieldClass('option-text-input', option)}
                value={option}
                ariaLabel={`Option ${String.fromCharCode(65 + index)}`}
                onChange={(value) => updateOption(index, value)}
              />
              {isCorrect ? (
                <span className="correct-badge">Correct</span>
              ) : null}
            </li>
          )
        })}
      </ul>
      <div className="slide-feedback">
        <span className="teacher-prompt-label">Feedback</span>
        <SlideTextInput
          className={fieldClass('slide-prompt-input', slide.feedback)}
          value={slide.feedback}
          ariaLabel="Feedback"
          multiline
          rows={2}
          onChange={(feedback) => onChange({ feedback })}
        />
      </div>
    </div>
  )
}

function SummarySlideView({
  slide,
  onChange,
}: {
  slide: SummarySlide
  onChange: (changes: Partial<SummarySlide>) => void
}) {
  function updateKeyPoint(index: number, value: string) {
    onChange({
      key_points: slide.key_points.map((point, pointIndex) =>
        pointIndex === index ? value : point,
      ),
    })
  }

  return (
    <div className="slide-view slide-view-summary">
      <SlideTextInput
        className={fieldClass('slide-title-input', slide.title)}
        value={slide.title}
        ariaLabel="Slide title"
        onChange={(title) => onChange({ title })}
      />
      <ul className="slide-bullets slide-bullets-editable">
        {slide.key_points.map((point, index) => (
          <li key={`key-point-${index}`}>
            <SlideTextInput
              className={fieldClass('slide-list-input', point)}
              value={point}
              ariaLabel={`Key point ${index + 1}`}
              multiline
              rows={1}
              onChange={(value) => updateKeyPoint(index, value)}
            />
          </li>
        ))}
      </ul>
      <div className="exit-question">
        <span className="teacher-prompt-label">Exit question</span>
        <SlideTextInput
          className={fieldClass('slide-prompt-input', slide.exit_question)}
          value={slide.exit_question}
          ariaLabel="Exit question"
          multiline
          rows={2}
          onChange={(exit_question) => onChange({ exit_question })}
        />
      </div>
    </div>
  )
}

function SlideCanvas({
  slide,
  onSlideChange,
}: {
  slide: PresentationSlide
  onSlideChange: (changes: Partial<PresentationSlide>) => void
}) {
  switch (slide.type) {
    case 'title':
      return (
        <TitleSlideView
          slide={slide}
          onChange={(changes) => onSlideChange(changes)}
        />
      )
    case 'content':
      return (
        <ContentSlideView
          slide={slide}
          onChange={(changes) => onSlideChange(changes)}
        />
      )
    case 'discussion':
      return (
        <DiscussionSlideView
          slide={slide}
          onChange={(changes) => onSlideChange(changes)}
        />
      )
    case 'multiple_choice':
      return (
        <MultipleChoiceSlideView
          slide={slide}
          onChange={(changes) => onSlideChange(changes)}
        />
      )
    case 'summary':
      return (
        <SummarySlideView
          slide={slide}
          onChange={(changes) => onSlideChange(changes)}
        />
      )
    default: {
      const _exhaustive: never = slide
      return _exhaustive
    }
  }
}

function slideTypeLabel(type: PresentationSlide['type']): string {
  switch (type) {
    case 'title':
      return 'Title'
    case 'content':
      return 'Content'
    case 'discussion':
      return 'Discussion'
    case 'multiple_choice':
      return 'Multiple choice'
    case 'summary':
      return 'Summary'
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
}

function PresentationEditorPage({
  presentation,
  onPresentationChange,
  onBack,
}: PresentationEditorPageProps) {
  const [selectedSlideId, setSelectedSlideId] = useState(
    presentation.slides[0]?.id ?? '',
  )
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null)
  const [insertIndex, setInsertIndex] = useState<number | null>(null)
  const [newSlideType, setNewSlideType] = useState<SlideType>('content')
  const [newSlideTitle, setNewSlideTitle] = useState('')
  const [newSlideDescription, setNewSlideDescription] = useState('')
  const [isGeneratingSlide, setIsGeneratingSlide] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  const selectedSlide =
    presentation.slides.find((slide) => slide.id === selectedSlideId) ??
    presentation.slides[0]

  const trimmedNewTitle = newSlideTitle.trim()
  const trimmedNewDescription = newSlideDescription.trim()
  const canGenerateSlide =
    trimmedNewTitle.length > 0 &&
    trimmedNewDescription.length >= 10 &&
    !isGeneratingSlide

  useEffect(() => {
    if (!openMenuId && insertIndex === null) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (insertIndex !== null) {
        return
      }

      const target = event.target as Node
      if (!sidebarRef.current?.contains(target)) {
        setOpenMenuId(null)
        return
      }

      const menuRoot = (event.target as HTMLElement).closest(
        '[data-thumbnail-menu]',
      )
      if (!menuRoot) {
        setOpenMenuId(null)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || isGeneratingSlide) {
        return
      }

      if (insertIndex !== null) {
        setInsertIndex(null)
        setNewSlideType('content')
        setNewSlideTitle('')
        setNewSlideDescription('')
        setGenerateError(null)
        return
      }

      setOpenMenuId(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenuId, insertIndex, isGeneratingSlide])

  function clearDragState() {
    setDraggedSlideId(null)
    setDropTargetId(null)
    setDropPosition(null)
  }

  function openAddSlideModal(index: number) {
    setOpenMenuId(null)
    setInsertIndex(index)
    setNewSlideType('content')
    setNewSlideTitle('')
    setNewSlideDescription('')
    setGenerateError(null)
  }

  function closeAddSlideModal() {
    if (isGeneratingSlide) {
      return
    }

    setInsertIndex(null)
    setNewSlideType('content')
    setNewSlideTitle('')
    setNewSlideDescription('')
    setGenerateError(null)
  }

  async function handleGenerateSlide() {
    if (insertIndex === null || !canGenerateSlide) {
      return
    }

    const previousSlide = presentation.slides[insertIndex - 1]
    const nextSlide = presentation.slides[insertIndex]

    setIsGeneratingSlide(true)
    setGenerateError(null)

    try {
      const generatedSlide = await generateSlide({
        presentation_title: presentation.title,
        learning_objective: presentation.learning_objective,
        slide_type: newSlideType,
        title: trimmedNewTitle,
        content_description: trimmedNewDescription,
        previous_slide_title: previousSlide?.title ?? null,
        next_slide_title: nextSlide?.title ?? null,
      })

      const nextSlides = [...presentation.slides]
      nextSlides.splice(insertIndex, 0, generatedSlide)

      onPresentationChange({
        ...presentation,
        slides: nextSlides,
      })
      setSelectedSlideId(generatedSlide.id)
      setIsGeneratingSlide(false)
      setInsertIndex(null)
      setNewSlideType('content')
      setNewSlideTitle('')
      setNewSlideDescription('')
      setGenerateError(null)
    } catch (requestError) {
      setGenerateError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to generate the slide. Please try again.',
      )
      setIsGeneratingSlide(false)
    }
  }

  function updateSlide(
    slideId: string,
    changes: Partial<PresentationSlide>,
  ) {
    onPresentationChange({
      ...presentation,
      slides: presentation.slides.map((slide) =>
        slide.id === slideId ? ({ ...slide, ...changes } as PresentationSlide) : slide,
      ),
    })
  }

  function deleteSlide(slideId: string) {
    if (presentation.slides.length === 1) {
      return
    }

    const deletedIndex = presentation.slides.findIndex(
      (slide) => slide.id === slideId,
    )
    const remainingSlides = presentation.slides.filter(
      (slide) => slide.id !== slideId,
    )

    onPresentationChange({
      ...presentation,
      slides: remainingSlides,
    })

    if (selectedSlideId === slideId) {
      const nextIndex = Math.min(deletedIndex, remainingSlides.length - 1)
      setSelectedSlideId(remainingSlides[nextIndex]?.id ?? '')
    }

    setOpenMenuId(null)
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

    if (
      !sourceSlideId ||
      !insertionPosition ||
      sourceSlideId === targetSlideId
    ) {
      return
    }

    const sourceIndex = presentation.slides.findIndex(
      (slide) => slide.id === sourceSlideId,
    )

    if (sourceIndex === -1) {
      return
    }

    const remainingSlides = presentation.slides.filter(
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
    reorderedSlides.splice(insertIndex, 0, presentation.slides[sourceIndex])

    onPresentationChange({
      ...presentation,
      slides: reorderedSlides,
    })
  }

  return (
    <main className="presentation-editor-page">
      <header className="presentation-editor-header">
        <button
          type="button"
          className="presentation-back-button"
          onClick={onBack}
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <div className="presentation-editor-heading">
          <p className="presentation-editor-kicker">Presentation editor</p>
          <h1>{presentation.title}</h1>
        </div>
      </header>

      <div className="presentation-editor-body">
        <aside
          className="presentation-sidebar"
          aria-label="Slides"
          ref={sidebarRef}
        >
          <ul className="presentation-thumbnail-list">
            {presentation.slides.map((slide, index) => {
              const isSelected = slide.id === selectedSlide?.id
              const isMenuOpen = openMenuId === slide.id
              const itemClasses = [
                'presentation-thumbnail-item',
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
                <li
                  key={slide.id}
                  className={itemClasses}
                  onDragOver={(event) => handleDragOver(event, slide.id)}
                  onDrop={(event) => handleDrop(event, slide.id)}
                >
                  <div className="presentation-thumbnail-row">
                    <button
                      type="button"
                      className="thumbnail-drag-handle"
                      draggable={true}
                      aria-label={`Drag slide ${index + 1} to reorder`}
                      title="Drag to reorder"
                      onDragStart={(event) => handleDragStart(event, slide.id)}
                      onDragEnd={clearDragState}
                    >
                      ⋮⋮
                    </button>

                    <button
                      type="button"
                      className={`presentation-thumbnail${
                        isSelected ? ' is-selected' : ''
                      }`}
                      aria-current={isSelected ? 'true' : undefined}
                      onClick={() => setSelectedSlideId(slide.id)}
                    >
                      <span className="thumbnail-number">{index + 1}</span>
                      <span className="thumbnail-copy">
                        <span className="thumbnail-type">
                          {slideTypeLabel(slide.type)}
                        </span>
                        <span
                          className={
                            isBlank(slide.title)
                              ? 'thumbnail-title is-empty'
                              : 'thumbnail-title'
                          }
                        >
                          {slide.title.trim() || 'Untitled slide'}
                        </span>
                      </span>
                    </button>

                    <div className="thumbnail-menu" data-thumbnail-menu="">
                      <button
                        type="button"
                        className="thumbnail-menu-button"
                        aria-label={`Open menu for slide ${index + 1}`}
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        onClick={() =>
                          setOpenMenuId(isMenuOpen ? null : slide.id)
                        }
                      >
                        <span aria-hidden="true">•••</span>
                      </button>
                      {isMenuOpen ? (
                        <div className="thumbnail-menu-popover" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            className="thumbnail-menu-add"
                            onClick={() => openAddSlideModal(index + 1)}
                          >
                            Add slide below
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="thumbnail-menu-delete"
                            disabled={presentation.slides.length === 1}
                            onClick={() => deleteSlide(slide.id)}
                          >
                            Delete slide
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="presentation-main" aria-label="Selected slide">
          {selectedSlide ? (
            <div className="slide-canvas-frame">
              <div className="slide-canvas">
                <SlideCanvas
                  slide={selectedSlide}
                  onSlideChange={(changes) =>
                    updateSlide(selectedSlide.id, changes)
                  }
                />
              </div>
            </div>
          ) : (
            <p className="presentation-empty">No slides in this presentation.</p>
          )}

          <div className="presentation-footer">
            <button type="button" className="present-button" disabled>
              Present
            </button>
          </div>
        </section>
      </div>

      {insertIndex !== null ? (
        <div className="add-slide-modal-backdrop">
          <div
            className="add-slide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="generate-slide-modal-title"
          >
            <h2 id="generate-slide-modal-title">Generate slide</h2>

            <form
              className="add-slide-modal-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleGenerateSlide()
              }}
            >
              <label>
                <span>Slide type</span>
                <select
                  value={newSlideType}
                  disabled={isGeneratingSlide}
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
                  disabled={isGeneratingSlide}
                  onChange={(event) => setNewSlideTitle(event.target.value)}
                  autoFocus
                />
              </label>

              <label>
                <span>Content description</span>
                <textarea
                  value={newSlideDescription}
                  disabled={isGeneratingSlide}
                  onChange={(event) =>
                    setNewSlideDescription(event.target.value)
                  }
                  maxLength={500}
                  rows={4}
                />
              </label>

              {generateError ? (
                <p className="generate-slide-error" role="alert">
                  {generateError}
                </p>
              ) : null}

              <div className="add-slide-modal-actions">
                <button
                  type="button"
                  className="add-slide-cancel"
                  disabled={isGeneratingSlide}
                  onClick={closeAddSlideModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="add-slide-submit"
                  disabled={!canGenerateSlide}
                >
                  {isGeneratingSlide ? 'Generating slide…' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default PresentationEditorPage
