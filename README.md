# Classroom Presentation Generator

Classroom Presentation Generator is an AI-powered tool for middle-school teachers. It turns a topic or detailed brief into a short, editable classroom presentation. The teacher uses the editor; students are the audience.

I framed the problem as lesson design, not slide production: combine explanation, participation, and checks for understanding while leaving the teacher in control.

## Why this product?

Generic AI tools can produce titles, facts, and summaries without forming a useful lesson. Teachers still need to sequence ideas, involve the class, surface misconceptions, check understanding, and control what is taught.

Direct chat still requires a detailed prompt, interpretation, and manual restructuring. This product makes the lesson structure explicit and editable.

### Why middle school?

Elementary teaching often needs more adaptation, play, and scaffolding than a presentation provides. High-school material can be specialized and curriculum-dependent. Middle-school students can engage with meaningful concepts, but passive instruction can lose attention. In my experience, growing independence while high-stakes examinations still feel distant makes participation a central challenge. The product alternates explanation, discussion, participation, and checks without assuming every class is alike.

## Product flow

Four stages avoid one take-it-or-leave-it AI result: define, structure, refine, and present.

### 1. Teacher brief

A free-text request and 10, 15, or 20-minute duration support broad topics and detailed instructions.

### 2. Editable outline

The system proposes an objective and ordered plan. The teacher can edit, add, delete, reorder, or regenerate before full content exists.

### 3. Editable presentation

The outline becomes type-specific content. The teacher can edit, add, delete, reorder, or generate one contextual slide. Visuals appear progressively.

### 4. Presentation mode

The classroom view supports keyboard and mouse navigation; the teacher controls multiple-choice answer reveal.

Returning to the outline does not synchronize presentation edits back into it. Generating again creates a new presentation and replaces the previous Stage 3 edits.

## Key decisions



### Focused audience and minimal input

The middle-school scope removes the grade selector. Duration determines slide count, language is inferred, and the canvas is fixed at 16:9. I omitted inactive controls that only imply configurability.

### Outline before presentation

Structure is cheaper to correct than finished copy and images. The outline provides that checkpoint for any level of input detail.

### Deterministic structure, generative content

The application owns slide count, initial order, types, IDs, and edited titles. The model fills those boundaries with pedagogical content.


| Duration   | Ordered structure                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 10 minutes | title → discussion → content → multiple choice → summary                                                         |
| 15 minutes | title → discussion → content → multiple choice → content → multiple choice → summary                             |
| 20 minutes | title → discussion → content → multiple choice → content → multiple choice → content → multiple choice → summary |


This keeps behavior predictable without removing useful generative work.

### Fixed slide types and structured output

The five types—`title`, `content`, `discussion`, `multiple_choice`, and `summary`—have distinct roles and UI. The model returns Pydantic-validated data, not arbitrary layouts; AI schemas exclude application-owned IDs and image URLs.

### Progressive images

Title and content images run independently after text is ready because images are slower and less reliable. Failure leaves a placeholder instead of invalidating the presentation.

### Teacher-controlled interaction

Students need no accounts or devices. The teacher gathers responses and reveals the answer, avoiding real-time classroom infrastructure.

### Explicit regeneration

Structural and text regeneration require a user action because calls cost time and may replace edits. Eligible image requests start automatically in the background.

## Architecture and AI pipeline



### Frontend

React and TypeScript fit an editor with discriminated slide types and typed backend contracts. `App.tsx` owns workflow state, page components represent stages, and the API service isolates HTTP. The frontend never calls OpenAI or receives the key.

### Backend

FastAPI provides the Python HTTP layer. Pydantic validates public contracts and Structured Outputs. The backend owns prompts, routing, structure, conversion, answer normalization, images, and errors. Without users or persistence, no database or authentication is needed.

### Provider modes and pipeline

OpenAI mode runs text and image generation. Mock mode tests the local flow without text-generation network calls; images remain placeholders.

`Teacher brief → outline generation → teacher edits → presentation generation → progressive images → editing and presentation`

Text uses the OpenAI Responses API with Pydantic Structured Outputs. Visuals use the OpenAI Image API.

## API


| Method | Path                          | Purpose                                                                     |
| ------ | ----------------------------- | --------------------------------------------------------------------------- |
| GET    | `/api/health`                 | Check that the server is ready                                              |
| POST   | `/api/outlines/generate`      | Turn a teacher brief and duration into an editable pedagogical structure    |
| POST   | `/api/presentations/generate` | Expand a teacher-edited outline into complete type-specific slides          |
| POST   | `/api/slides/generate`        | Generate one contextual slide without replacing existing presentation edits |
| POST   | `/api/images/generate`        | Generate one visual for an eligible title or content slide                  |


Single-slide generation preserves the teacher’s existing edits and avoids regenerating the entire presentation. Neighboring slide titles provide enough context to keep the new slide coherent with its surroundings.

## Run locally

I ran the project with Python 3.13.3. The installed Vite 8 package requires Node `^20.19.0` or `>=22.12.0`.

From the repository root, create and activate a backend environment:

```powershell
# Windows PowerShell
python -m venv backend/.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

```bash
# macOS or Linux
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Configure `backend/.env`:

```dotenv
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-5.6
OPENAI_IMAGE_MODEL=gpt-image-2
GENERATION_PROVIDER=openai
```

The repository does not contain my OpenAI API key. Add your own to Git-ignored `backend/.env` for real generation; it is never sent to the frontend.

Start FastAPI from the repository root:

```bash
python -m uvicorn backend.main:app --reload
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the frontend at [http://localhost:5173](http://localhost:5173), the backend at [http://localhost:8000](http://localhost:8000), and Swagger UI at [http://localhost:8000/docs](http://localhost:8000/docs). The frontend API URL defaults to `http://localhost:8000`; `frontend/.env.example` shows how to override it.

Provider behavior:

```env
GENERATION_PROVIDER=openai
# Requires your own OpenAI API key and may incur API cost.

GENERATION_PROVIDER=mock
# Tests the product flow, editing, and presentation without OpenAI text calls.
# Image generation is disabled, so placeholders remain.
```



## Validation

```bash
python -m unittest discover -s backend/tests -v
python -m compileall backend

cd frontend
npm run lint
npm run build
```

There are 18 backend unit tests covering deterministic structures, model validation, mock conversion, multiple-choice option handling, Structured Outputs schema compatibility, and image-request validation. They do not make OpenAI requests.

## Scope and limitations

This MVP stores state in React memory, so refresh loses work. I considered `localStorage` but prioritized the complete generation, editing, image, and presentation flow. There is no database, authentication, or cross-device persistence. Images are temporary local files; text edits do not regenerate them. Regenerating from the outline replaces Stage 3 edits. There is no export, and teachers must review generated content.

## Working with AI

I used Cursor for scaffolding, implementation, refactoring, and debugging. I owned the framing, scope, flow, schemas, and tradeoffs, reviewing changes through diffs, manual QA, lint, builds, compilation, and tests. AI helped with repetitive work and parallel Python/TypeScript models; it was less reliable with implicit constraints.

## What I would do next

1. **Validate the product with teachers.** Learn how teachers plan and deliver lessons, where time is lost, and what the prototype misses.
2. **Source-grounded lesson generation.** Generate from documents or pasted material with citations or source references.
3. **AI-assisted slide revision.** Revise an existing slide through natural-language instructions, not only field editing.
4. **Presenter notes.** Add teacher-only notes, separate from projected student content.
5. **Image regeneration.** Generate an alternative visual without recreating slide text.
6. **Themes and layout choices.** Add variety while keeping layouts predictable and editable.
7. **Language and aspect-ratio controls.** Replace inference and fixed 16:9 with real controls.
8. **Export.** Add PowerPoint or Google Slides output.
9. **Modular interactive slide types.** Extend the closed system with interactive or plugin-style components.
10. **Learning-system integration.** Connect responses to longitudinal tracking and learning-outcome measurement.

