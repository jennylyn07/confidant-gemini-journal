# Confidant: User-Authenticated Gemini Journal & Reflections

Confidant is a full-stack, user-authenticated journaling and structured reflection web application powered by **Gemini 3.6 Flash** and **Cloud Firestore**. Users authenticate securely via **Firebase Authentication** (Google Sign-In) to converse with Gemini in multi-turn dialogues, generate executive summaries, brainstorm creative ideas, and construct actionable task plans. All user interactions and reflection entries are strictly isolated to the authenticated user's Firestore path.

---

## 1. System Architecture & Threat Model Summary

In alignment with **Directive #1 (Agentic Threat Modeling)**, system risks across the 5 Threat Zones are mapped to production countermeasures:

| Threat Zone | Identified Risk | Countermeasure / Production Security Control |
| :--- | :--- | :--- |
| **Input Surfaces** | Prompt injection, malformed payloads, non-JSON inputs | Top-level JSON body parsing (`limit: 10mb`), null-safe destructuring, and explicit parameterization. |
| **Planning & Reasoning** | Upstream API latency, rate limits (429/503), model unavailability | Resilient 4-tier model fallback ladder: `gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`. |
| **Tool & AI Execution** | SSRF, privilege escalation, browser key leakage | Server-side proxy (`/api/gemini/*`); zero client-side exposure of `GEMINI_API_KEY`. Reusable HTTPS client with connection pooling. |
| **Memory & State** | Cross-user data leakage, unauthenticated document manipulation | Owner-bound Cloud Firestore security rules (`request.auth.uid == userId`) with zero insecure defaults (`allow read, write: if false;` by default). |
| **Inter-System Communication** | Credential theft, database crash on `undefined` values | Passwordless Federated Identity (Firebase Auth); defensive payload stripping (`sanitizeForFirestore`) guaranteeing zero-crash persistence. |

---

## 2. Environment & Prerequisites

### Prerequisites
- **Google Cloud SDK (`gcloud`)** installed and authenticated:
  ```bash
  gcloud auth login
  gcloud config set project YOUR_PROJECT_ID
  ```
- **Node.js** (v20+) and **npm** installed.
- **Firebase CLI** (optional, for direct rule deployments):
  ```bash
  npm install -g firebase-tools
  firebase login
  ```

### Enable Google Cloud APIs
Enable the required APIs on your Google Cloud project:
```bash
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com
```

---

## 3. Secret & Configuration Management

### Current Implementation: Environment Variable Injection
In compliance with **Directive #4**, this deployment currently utilizes **environment variable injection** for runtime configuration. The Gemini API key is injected directly into the Cloud Run container runtime environment (or injected automatically by the AI Studio platform). The key is accessed strictly server-side via `process.env.GEMINI_API_KEY` and is never exposed to the client bundle.

#### Local Environment Configuration
1. Copy the example configuration template:
   ```bash
   cp .env.example .env
   ```
2. Populate `.env` with your API credentials (ensure `.env` is ignored by version control):
   ```env
   GEMINI_API_KEY="your-gemini-api-key-here"
   ```

#### Cloud Run Environment Injection
When deploying directly via `gcloud run deploy`, supply the environment variable:
```bash
gcloud run deploy confidant \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="YOUR_GEMINI_API_KEY" \
  --port 3000
```

---

### Documented Upgrade Path: Google Cloud Secret Manager
While environment variable injection is currently deployed, integrating **Google Cloud Secret Manager** is a recommended upgrade path for centralized key rotation and enhanced IAM auditing:

```bash
# 1. Create the Secret in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 2. Populate the secret with your key
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant the Cloud Run compute service account permission to access the secret
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 4. Deploy to Cloud Run mounting the Secret as an environment variable
gcloud run deploy confidant \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --port 3000
```

---

## 4. Cloud Firestore Database & Security Configuration

Confidant uses Cloud Firestore in Native Mode. All journal entries and interaction records are strictly compartmentalized under `/users/{userId}` paths.

### Owner-Bound Security Rules (`firestore.rules`)
Deploy the following security rules to prevent unauthorized reads and writes across tenants:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Exact isolated pattern for interaction logs (Directive #7 compliance)
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Isolated pattern for user journal entries and chat history
    match /users/{userId}/entries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // User profile document isolation
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Deploy the rules via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Google Cloud Run Deployment Flow

Deploy the containerized full-stack application (Express backend + Vite client) to Google Cloud Run:

```bash
# Deploy service with environment variable injection
gcloud run deploy confidant \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="YOUR_GEMINI_API_KEY" \
  --port 3000
```

---

## 6. Required Campaign Labeling (Verification Binding)

To register the service for automated challenge verification under the Google Cloud Run campaign, apply the mandatory resource label:

```bash
gcloud run services update confidant \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

To verify the label was applied successfully:
```bash
gcloud run services describe confidant \
  --region=us-central1 \
  --format="value(metadata.labels)"
```

---

## 7. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment file
cp .env.example .env
# Edit .env and enter your valid GEMINI_API_KEY

# 3. Start unified dev server (Express + Vite on Port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 8. Repository Hygiene & Secret Exclusion

The project repository strictly adheres to **Zero-Hardcoding Hygiene (Directive #4)**:
- `.gitignore` explicitly ignores `.env`, `.env.*`, `node_modules/`, build outputs (`dist/`), service account keys (`*serviceAccount*.json`, `*credentials*.json`), and log files.
- `!.env.example` is committed purely as an unpopulated schema reference.
- No production API keys, service credentials, or access tokens are checked into version control.

---

## 9. Attribution & Acknowledgments

This project is built upon the architectural patterns, security directives, and starter framework presented in the **[Google Cloud Run AI Challenge Codelab](https://codelabs.developers.google.com/codelabs/cloud-run/cloud-run-ai-challenge)** by Google LLC.

The codelab materials and associated starter directives are licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)** and the **Apache License, Version 2.0**.
