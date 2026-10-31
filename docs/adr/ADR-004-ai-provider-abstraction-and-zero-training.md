# ADR-004: AI Architecture: 3-Mode Provider Abstraction & Zero-Training Compliance

**Date:** 2026-10-29  
**Status:** Accepted

## Context

The platform includes AI capabilities: CV import from PDF/DOCX via text extraction and structured JSON output, job description tailoring, ATS scoring, and Arabic/English translation.
However:

1. Under our Zero-Cost constraints, running self-hosted multi-billion parameter LLMs is impossible on a standard free-tier VM without a dedicated GPU.
2. Standard consumer **free tiers** (e.g. Google Gemini API free tier) explicitly state in their terms that prompts and model outputs may be logged and used to train future models. This directly violates GDPR Articles 5, 28, and Lebanese Law 81/2018.
3. User trust requires full transparency before any data leaves the platform.

## Decision

1. **AI is completely DISABLED by default in the MVP build.**
2. Build an **AiProvider Strategy Abstraction** with three distinct operating modes:
   - **Mode A (`disabled`):** Default for MVP. Returns a friendly message indicating AI features are inactive. $0 cost, 0 network requests.
   - **Mode B (`byok` - Bring Your Own Key):** Allows individual users to enter their personal Gemini or OpenAI API key directly in their browser session. The key remains on the client or in a temporary session; requests are routed to the provider under the user's personal terms. The platform incurs $0 cost.
   - **Mode C (`paid-users-only`):** Deferred until Phase 3 and billing approval. Routes to an enterprise paid endpoint (e.g., Vertex AI / paid Google AI Studio) with signed DPAs guaranteeing **zero model training and zero data retention**.
3. **Mandatory Review Screen:** Regardless of provider or mode, imported CV data is never committed directly to the database. It is staged in `import_jobs` and displayed on a side-by-side human review screen for explicit user approval (UC-22).
4. **Prompt Injection Hardening:** Untrusted user CV and job texts are wrapped in strict delimiters (`<user_text>`), the model operates with no execution tools or system secrets, and all outputs are validated against strict Zod schemas.

## Consequences

- The MVP can be launched and verified with $0 operational cost and zero privacy compliance risks regarding AI training.
- Future monetization can activate Phase 3 smoothly via environment configuration without code rewrites.
