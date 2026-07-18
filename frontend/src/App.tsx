import { useRef, useState } from 'react'

import LessonBriefPage from './pages/LessonBriefPage'
import OutlineEditorPage from './pages/OutlineEditorPage'
import PresentationEditorPage from './pages/PresentationEditorPage'
import PresentationModePage from './pages/PresentationModePage'
import { generateSlideImage, resolveApiAssetUrl } from './services/api'
import type {
  ContentSlide,
  LessonBrief,
  Presentation,
  PresentationOutline,
  PresentationSlide,
  TitleSlide,
} from './types/presentation'

type ImageCapableSlide = TitleSlide | ContentSlide

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
  const [imageLoadingSlideIds, setImageLoadingSlideIds] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const imageGenerationRunRef = useRef(0)
  const imageRequestsInFlightRef = useRef<Set<string>>(new Set())

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

  function requestImageForSlide(
    slide: ImageCapableSlide,
    presentationContext: Pick<
      Presentation,
      'title' | 'learning_objective'
    >,
    imageGenerationRun = imageGenerationRunRef.current,
  ) {
    if (slide.image_url) {
      return
    }

    const requestKey = `${imageGenerationRun}:${slide.id}`
    if (imageRequestsInFlightRef.current.has(requestKey)) {
      return
    }

    imageRequestsInFlightRef.current.add(requestKey)
    setImageLoadingSlideIds((currentIds) => {
      const nextIds = new Set(currentIds)
      nextIds.add(slide.id)
      return nextIds
    })

    void generateSlideImage({
      presentation_title: presentationContext.title,
      learning_objective: presentationContext.learning_objective,
      slide,
    })
      .then((result) => {
        if (
          imageGenerationRunRef.current !== imageGenerationRun ||
          result.slide_id !== slide.id
        ) {
          return
        }

        setPresentation((currentPresentation) => {
          if (
            !currentPresentation?.slides.some(
              (currentSlide) => currentSlide.id === result.slide_id,
            )
          ) {
            return currentPresentation
          }

          return {
            ...currentPresentation,
            slides: currentPresentation.slides.map((currentSlide) =>
              currentSlide.id === result.slide_id &&
              (currentSlide.type === 'title' ||
                currentSlide.type === 'content')
                ? {
                    ...currentSlide,
                    image_url: resolveApiAssetUrl(result.image_url),
                  }
                : currentSlide,
            ),
          }
        })
      })
      .catch(() => {
        console.warn(`Image generation failed for slide ${slide.id}.`)
      })
      .finally(() => {
        imageRequestsInFlightRef.current.delete(requestKey)

        if (imageGenerationRunRef.current !== imageGenerationRun) {
          return
        }

        setImageLoadingSlideIds((currentIds) => {
          const nextIds = new Set(currentIds)
          nextIds.delete(slide.id)
          return nextIds
        })
      })
  }

  function handlePresentationGenerated(nextPresentation: Presentation) {
    const imageGenerationRun = imageGenerationRunRef.current + 1
    imageGenerationRunRef.current = imageGenerationRun
    imageRequestsInFlightRef.current.clear()

    const slidesNeedingImages = nextPresentation.slides.filter(
      (slide): slide is ImageCapableSlide =>
        (slide.type === 'title' || slide.type === 'content') && !slide.image_url,
    )

    setImageLoadingSlideIds(new Set())
    setPresentation(nextPresentation)
    setView('presentation')

    for (const slide of slidesNeedingImages) {
      requestImageForSlide(slide, nextPresentation, imageGenerationRun)
    }
  }

  function handleSlideAdded(slide: PresentationSlide) {
    if (
      !presentation ||
      (slide.type !== 'title' && slide.type !== 'content')
    ) {
      return
    }

    requestImageForSlide(slide, presentation)
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
        imageLoadingSlideIds={imageLoadingSlideIds}
        onSlideAdded={handleSlideAdded}
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
