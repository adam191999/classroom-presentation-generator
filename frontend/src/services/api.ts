import type {
  LessonBrief,
  Presentation,
  PresentationOutline,
  PresentationSlide,
  SlideGenerationRequest,
} from '../types/presentation'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  'http://localhost:8000'

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const details = await response.text()
    const message = details
      ? `${response.status} ${response.statusText}: ${details}`
      : `${response.status} ${response.statusText}`

    throw new Error(`API request failed with ${message}`)
  }

  return response.json() as Promise<T>
}

export function generateOutline(
  brief: LessonBrief,
): Promise<PresentationOutline> {
  return request<PresentationOutline>('/api/outlines/generate', brief)
}

export function generatePresentation(
  outline: PresentationOutline,
): Promise<Presentation> {
  return request<Presentation>('/api/presentations/generate', outline)
}

export function generateSlide(
  slideRequest: SlideGenerationRequest,
): Promise<PresentationSlide> {
  return request<PresentationSlide>('/api/slides/generate', slideRequest)
}
