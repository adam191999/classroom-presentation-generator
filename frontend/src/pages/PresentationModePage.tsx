import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'

import type {
  ContentSlide,
  DiscussionSlide,
  MultipleChoiceSlide,
  Presentation,
  PresentationSlide,
  SummarySlide,
  TitleSlide,
} from '../types/presentation'
import './PresentationModePage.css'

interface PresentationModePageProps {
  presentation: Presentation
  onExit: () => void
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
      <div className="mode-image-frame">
        <img src={imageUrl} alt={alt} className="mode-image" />
      </div>
    )
  }

  return (
    <div className="mode-image-placeholder" aria-hidden="true">
      <span>Image placeholder</span>
    </div>
  )
}

function TitleSlideView({ slide }: { slide: TitleSlide }) {
  return (
    <div className="mode-slide mode-slide-title">
      <div className="mode-slide-copy">
        <h1 className="mode-title">{slide.title}</h1>
        {slide.subtitle ? (
          <p className="mode-subtitle">{slide.subtitle}</p>
        ) : null}
      </div>
      <ImageArea imageUrl={slide.image_url} alt={slide.title} />
    </div>
  )
}

function ContentSlideView({ slide }: { slide: ContentSlide }) {
  return (
    <div className="mode-slide mode-slide-content">
      <div className="mode-slide-copy">
        <h2 className="mode-title">{slide.title}</h2>
        {slide.body ? <p className="mode-body">{slide.body}</p> : null}
        <ul className="mode-bullets">
          {slide.bullet_points.map((point, index) => (
            <li key={`bullet-${index}`}>{point}</li>
          ))}
        </ul>
      </div>
      <ImageArea imageUrl={slide.image_url} alt={slide.title} />
    </div>
  )
}

function DiscussionSlideView({ slide }: { slide: DiscussionSlide }) {
  return (
    <div className="mode-slide mode-slide-centered">
      <h2 className="mode-title">{slide.title}</h2>
      <p className="mode-question">{slide.question}</p>
    </div>
  )
}

function MultipleChoiceSlideView({
  slide,
  isRevealed,
  onReveal,
}: {
  slide: MultipleChoiceSlide
  isRevealed: boolean
  onReveal: () => void
}) {
  return (
    <div className="mode-slide mode-slide-centered">
      <h2 className="mode-title">{slide.title}</h2>
      <p className="mode-question">{slide.question}</p>
      <ul className="mode-options">
        {slide.options.map((option, index) => {
          const isCorrect = index === slide.correct_option
          const optionClass =
            isRevealed && isCorrect ? 'mode-option is-correct' : 'mode-option'

          return (
            <li key={`option-${index}`} className={optionClass}>
              <span className="mode-option-marker">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="mode-option-text">{option}</span>
              {isRevealed && isCorrect ? (
                <span className="mode-correct-badge">Correct</span>
              ) : null}
            </li>
          )
        })}
      </ul>
      {isRevealed ? (
        <div className="mode-feedback">
          <span className="mode-feedback-label">Feedback</span>
          <p>{slide.feedback}</p>
        </div>
      ) : (
        <button
          type="button"
          className="mode-reveal-button"
          onClick={(event) => {
            event.stopPropagation()
            onReveal()
          }}
        >
          Reveal answer
        </button>
      )}
    </div>
  )
}

function SummarySlideView({ slide }: { slide: SummarySlide }) {
  return (
    <div className="mode-slide mode-slide-centered">
      <h2 className="mode-title">{slide.title}</h2>
      <ul className="mode-bullets">
        {slide.key_points.map((point, index) => (
          <li key={`key-point-${index}`}>{point}</li>
        ))}
      </ul>
      <div className="mode-exit-question">
        <span className="mode-feedback-label">Exit question</span>
        <p>{slide.exit_question}</p>
      </div>
    </div>
  )
}

function SlideView({
  slide,
  isRevealed,
  onReveal,
}: {
  slide: PresentationSlide
  isRevealed: boolean
  onReveal: () => void
}) {
  switch (slide.type) {
    case 'title':
      return <TitleSlideView slide={slide} />
    case 'content':
      return <ContentSlideView slide={slide} />
    case 'discussion':
      return <DiscussionSlideView slide={slide} />
    case 'multiple_choice':
      return (
        <MultipleChoiceSlideView
          slide={slide}
          isRevealed={isRevealed}
          onReveal={onReveal}
        />
      )
    case 'summary':
      return <SummarySlideView slide={slide} />
    default: {
      const _exhaustive: never = slide
      return _exhaustive
    }
  }
}

function PresentationModePage({
  presentation,
  onExit,
}: PresentationModePageProps) {
  const slideCount = presentation.slides.length
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const containerRef = useRef<HTMLDivElement>(null)

  const safeIndex = Math.min(currentIndex, Math.max(slideCount - 1, 0))
  const currentSlide = presentation.slides[safeIndex]
  const isFirstSlide = safeIndex === 0
  const isLastSlide = safeIndex >= slideCount - 1

  function goNext() {
    setCurrentIndex((index) => Math.min(index + 1, slideCount - 1))
  }

  function goPrevious() {
    setCurrentIndex((index) => Math.max(index - 1, 0))
  }

  function revealCurrentAnswer() {
    if (!currentSlide) {
      return
    }

    setRevealedIds((previous) => {
      const next = new Set(previous)
      next.add(currentSlide.id)
      return next
    })
  }

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onExit()
        return
      }

      const active = document.activeElement
      if (active) {
        const tag = active.tagName.toLowerCase()
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          tag === 'button'
        ) {
          return
        }
      }

      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        setCurrentIndex((index) => Math.min(index + 1, slideCount - 1))
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setCurrentIndex((index) => Math.max(index - 1, 0))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onExit, slideCount])

  function handleStageClick(event: ReactMouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const isRightHalf = event.clientX - bounds.left > bounds.width / 2

    if (isRightHalf) {
      goNext()
    } else {
      goPrevious()
    }
  }

  return (
    <div
      className="presentation-mode-page"
      ref={containerRef}
      tabIndex={-1}
      role="application"
      aria-label="Presentation mode"
    >
      <div className="mode-topbar">
        <span className="mode-counter" aria-live="polite">
          {slideCount === 0 ? '0 / 0' : `${safeIndex + 1} / ${slideCount}`}
        </span>
        <button
          type="button"
          className="mode-exit-button"
          aria-label="Exit presentation mode"
          onClick={(event) => {
            event.stopPropagation()
            onExit()
          }}
        >
          Exit
        </button>
      </div>

      <div className="mode-stage" onClick={handleStageClick}>
        <button
          type="button"
          className="mode-nav mode-nav-previous"
          aria-label="Previous slide"
          disabled={isFirstSlide}
          onClick={(event) => {
            event.stopPropagation()
            goPrevious()
          }}
        >
          <span aria-hidden="true">‹</span>
        </button>

        <div className="mode-slide-frame">
          {currentSlide ? (
            <SlideView
              slide={currentSlide}
              isRevealed={revealedIds.has(currentSlide.id)}
              onReveal={revealCurrentAnswer}
            />
          ) : (
            <p className="mode-empty">No slides to present.</p>
          )}
        </div>

        <button
          type="button"
          className="mode-nav mode-nav-next"
          aria-label="Next slide"
          disabled={isLastSlide}
          onClick={(event) => {
            event.stopPropagation()
            goNext()
          }}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  )
}

export default PresentationModePage
