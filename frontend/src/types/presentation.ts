export type DurationMinutes = 10 | 15 | 20

export type SlideType =
  | 'title'
  | 'content'
  | 'discussion'
  | 'multiple_choice'
  | 'summary'

export interface LessonBrief {
  prompt: string
  duration_minutes: DurationMinutes
}

export interface OutlineSlide {
  id: string
  type: SlideType
  title: string
  content_summary: string[]
}

export interface PresentationOutline {
  title: string
  learning_objective: string
  slides: OutlineSlide[]
}

export interface TitleSlide {
  id: string
  type: 'title'
  title: string
  subtitle?: string | null
  image_url?: string | null
}

export interface ContentSlide {
  id: string
  type: 'content'
  title: string
  body: string
  bullet_points: string[]
  image_url?: string | null
}

export interface DiscussionSlide {
  id: string
  type: 'discussion'
  title: string
  question: string
  teacher_prompt: string
}

export interface MultipleChoiceSlide {
  id: string
  type: 'multiple_choice'
  title: string
  question: string
  options: string[]
  correct_option: number
  feedback: string
}

export interface SummarySlide {
  id: string
  type: 'summary'
  title: string
  key_points: string[]
  exit_question: string
}

export type PresentationSlide =
  | TitleSlide
  | ContentSlide
  | DiscussionSlide
  | MultipleChoiceSlide
  | SummarySlide

export interface Presentation {
  title: string
  learning_objective: string
  slides: PresentationSlide[]
}

export interface SlideGenerationRequest {
  presentation_title: string
  learning_objective: string
  slide_type: SlideType
  title: string
  content_description: string
  previous_slide_title?: string | null
  next_slide_title?: string | null
}

export interface SlideImageGenerationRequest {
  presentation_title: string
  learning_objective: string
  slide: TitleSlide | ContentSlide
}

export interface SlideImageGenerationResponse {
  slide_id: string
  image_url: string
}
