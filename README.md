# VanderLeest Trailer Sales

Modern, production-grade website for [VanderLeest Trailer Sales](https://vanderleesttrailers.com/) — Northeastern Wisconsin's premier trailer dealer. Built with Angular 17 and deployed as a single AWS CDK stack with a built-in admin CMS so the client can manage all content without developer help.

---

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Frontend Architecture](#frontend-architecture)
- [Admin Panel (CMS)](#admin-panel-cms)
- [Backend Architecture](#backend-architecture)
- [Content Data Model](#content-data-model)
- [Design System](#design-system)
- [Local Development](#local-development)
- [Build](#build)
- [AWS Deployment](#aws-deployment)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [Tech Stack](#tech-stack)

---

## Overview

This project replaces the existing WordPress/Divi site with a modern Angular SPA backed by a serverless AWS architecture. All content was scraped from the original site and structured into editable data.

**What was built:**
- 9 public pages recreating the full original website
- Admin panel with Cognito login for the client to edit all content
- Inventory management system for trailers (CRUD with image upload)
- Serverless API (Lambda + API Gateway + DynamoDB)
- Single-command deployment via AWS CDK
- CI/CD pipelines via GitHub Actions

---

## Project Structure

```
vanderleesttrailers/
├── .github/
│   └── workflows/
│       ├── deploy.yml              # Build + deploy on push to main
│       └── pr-check.yml            # Build + validate on PRs
├── frontend/                       # Angular 17 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/              # Admin panel (CMS)
│   │   │   │   ├── login/          #   Cognito login page
│   │   │   │   ├── dashboard/      #   Section overview with quick links
│   │   │   │   ├── content-editor/ #   Generic form editor for any content type
│   │   │   │   ├── inventory-editor/ # Trailer list with search/filter/delete
│   │   │   │   └── trailer-form/   #   Add/edit trailer with image upload
│   │   │   ├── components/         # Shared UI components
│   │   │   │   ├── header/         #   Sticky nav, mobile menu, dropdowns
│   │   │   │   ├── footer/         #   4-column footer with links + contact
│   │   │   │   └── faq/            #   Accordion FAQ section
│   │   │   ├── data/
│   │   │   │   └── site-content.ts #   All website content (static fallback)
│   │   │   ├── guards/
│   │   │   │   └── admin.guard.ts  #   Cognito auth route guard
│   │   │   ├── pages/              # Public pages (all lazy-loaded)
│   │   │   │   ├── home/           #   Hero, intro, categories, brands, services, reviews, FAQ, CTA
│   │   │   │   ├── about/          #   Company story, founder bio
│   │   │   │   ├── inventory/      #   Category grid + filtered views
│   │   │   │   ├── services/       #   Service cards (welding, painting, etc.)
│   │   │   │   ├── custom-trailers/#   Custom work gallery
│   │   │   │   ├── financing/      #   3 financing partner cards
│   │   │   │   ├── reviews/        #   Customer testimonials
│   │   │   │   └── contact/        #   Form, map, phone, social links
│   │   │   └── services/           # Angular services
│   │   │       ├── content.service.ts  # Public API client (cached reads)
│   │   │       ├── auth.service.ts     # Cognito authentication
│   │   │       └── admin-api.service.ts# Admin CRUD + image upload
│   │   ├── environments/
│   │   │   ├── environment.ts      # Dev config (Cognito IDs, API URL)
│   │   │   └── environment.prod.ts # Prod config
│   │   ├── styles.scss             # Global styles + CSS variables
│   │   ├── index.html              # Shell HTML with meta tags
│   │   ├── favicon.svg             # SVG favicon (V monogram)
│   │   └── favicon.ico             # ICO fallback
│   ├── angular.json                # Angular build config
│   └── package.json
├── cdk/                            # AWS CDK infrastructure (single stack)
│   ├── bin/
│   │   └── app.ts                  # CDK app entry point
│   ├── lib/
│   │   └── vanderleest-stack.ts    # All AWS resources defined here
│   ├── lambda/
│   │   ├── content-api/
│   │   │   └── index.mjs           # Public read endpoints (GET)
│   │   ├── admin-api/
│   │   │   └── index.mjs           # Admin CRUD + pre-signed uploads (PUT/POST/DELETE)
│   │   └── seed/
│   │       └── index.mjs           # First-deploy data seeder
│   ├── cdk.json
│   ├── tsconfig.json
│   └── package.json
├── .gitignore
├── package.json                    # Root scripts: start, build, deploy, install:all
└── README.md
```

---

## Frontend Architecture

### Angular 17 with standalone components

Every component uses Angular's standalone component API — no NgModules. All page routes are lazy-loaded for fast initial load.

### Routing

```
/                          → HomeComponent
/about                     → AboutComponent
/inventory                 → InventoryComponent (all categories)
/inventory/:category       → InventoryComponent (filtered)
/services                  → ServicesComponent
/custom-trailers           → CustomTrailersComponent
/financing                 → FinancingComponent
/reviews                   → ReviewsComponent
/contact                   → ContactComponent
/admin/login               → AdminLoginComponent
/admin                     → AdminDashboardComponent (guarded)
/admin/edit/:type          → ContentEditorComponent (guarded)
/admin/inventory           → InventoryEditorComponent (guarded)
/admin/inventory/new       → TrailerFormComponent (guarded)
/admin/inventory/edit/:slug→ TrailerFormComponent (guarded)
```

### Shared Components

| Component | Location | Description |
|-----------|----------|-------------|
| `HeaderComponent` | `components/header/` | Fixed header that transitions from transparent to solid on scroll. Desktop nav with dropdowns, mobile hamburger menu. Phone CTA. |
| `FooterComponent` | `components/footer/` | 4-column layout: logo + social, quick links, inventory links, contact info. Amber accent line at top. |
| `FaqComponent` | `components/faq/` | Accordion-style FAQ section reused on Home, About, Services, and Financing pages. |

### Content Data (`site-content.ts`)

All website content is centralized in a single TypeScript file for local development:

| Export | What it controls |
|--------|-----------------|
| `SITE_INFO` | Business name, phone, address, hours, social links, logo URLs |
| `NAV_LINKS` | Navigation menu items and dropdown children |
| `HOME_CONTENT` | Hero text, intro section, services heading, CTA buttons |
| `ABOUT_CONTENT` | Company story paragraphs, founder bio and image |
| `SERVICES_CONTENT` | Hero, service cards (name, icon URL, description) |
| `CUSTOM_TRAILERS_CONTENT` | Hero, gallery items with titles and images |
| `FINANCING_CONTENT` | Hero, 3 financing partner cards with features and application URLs |
| `CONTACT_CONTENT` | Hero, contact form config, success message |
| `FAQ_CONTENT` | Array of question/answer objects |
| `TRAILER_BRANDS` | 6 brand names: Black Rhino, Maxx-D, Gatormade, Retco, DuraBull, Rock Solid Cargo |
| `TRAILER_CATEGORIES` | 7 inventory categories with name, slug, image URL, description |
| `REVIEWS` | Customer testimonials with name, rating, text |
| `IMAGES` | All image URLs organized by section (hero, icons, logos, founder, reviews) |

### Services

| Service | Purpose |
|---------|---------|
| `ContentService` | Fetches content from `/api/content/{type}` and `/api/trailers`. Includes in-memory cache with 5-minute TTL. |
| `AuthService` | Wraps `amazon-cognito-identity-js` for login, logout, session management, and JWT token retrieval. Handles first-login password challenge. |
| `AdminApiService` | Authenticated API calls for admin CRUD operations: update content, create/update/delete trailers, get pre-signed S3 upload URLs, upload images. |

---

## Admin Panel (CMS)

The admin panel is built into the same Angular app under `/admin` routes, protected by a Cognito auth guard.

### Login (`/admin/login`)
- Email/password authentication via Cognito
- Handles first-login temporary password flow automatically
- JWT stored in browser via Cognito SDK (localStorage)

### Dashboard (`/admin`)
- Grid of cards linking to all 11 editable content sections
- Quick link to Inventory Manager
- Logout button

### Content Editor (`/admin/edit/:type`)
- **Generic form editor** that works for any content type
- Automatically generates form fields from the data structure:
  - Top-level strings → text inputs
  - Long strings (100+ chars) → textareas
  - Numbers → number inputs
  - Nested objects → grouped sections with headers
  - Arrays → item cards with add/remove buttons
- **Raw JSON editor** (collapsed by default) for advanced edits
- Save button writes to DynamoDB via admin API
- Toast notifications for success/error

### Inventory Manager (`/admin/inventory`)
- Table view of all trailers
- Search by name or brand
- Filter by category dropdown
- Edit and Delete buttons per row
- Delete with confirmation dialog

### Trailer Form (`/admin/inventory/new` and `/admin/inventory/edit/:slug`)
- Fields: name, category (dropdown), brand (dropdown), price, GVWR, description, features (one per line)
- **Image management:**
  - Upload images via file picker (drag-and-drop styled)
  - Images upload to S3 via pre-signed URLs
  - Paste image URLs directly
  - Remove images with X button
  - Thumbnail preview grid

### What the client can edit:

| Section | Content Type Key | Fields |
|---------|-----------------|--------|
| Site Info | `SITE_INFO` | Name, phone, address, hours, social links, logos |
| Home Page | `PAGE_HOME` | Hero heading/subheading, intro text, CTA buttons |
| About Page | `PAGE_ABOUT` | Story paragraphs, founder name/title/bio/image |
| Services | `SERVICES` | Hero text, service cards (name, icon, description) |
| Custom Trailers | `CUSTOM_TRAILERS` | Hero text, gallery items (title, image, description) |
| Financing | `FINANCING` | Hero text, partner cards (name, credit req, features, URL) |
| Contact | `CONTACT` | Hero text, form success message |
| FAQ | `FAQ` | Array of question/answer pairs (add/remove) |
| Reviews | `REVIEWS` | Array of testimonials (add/remove) |
| Brands | `BRANDS` | Array of brand name/slug pairs |
| Categories | `CATEGORIES` | Array of category name/slug/image/description |
| Trailers | `TRAILER` | Full CRUD with images via Inventory Manager |

---

## Backend Architecture

Everything deploys as a **single CDK stack** (`VanderLeestTrailersStack`).

### AWS Resources

```
┌─────────────────────────────────────────────────────────────────┐
│                    VanderLeestTrailersStack                      │
│                                                                 │
│  ┌───────────┐   ┌────────────┐   ┌────────────────────────┐   │
│  │ CloudFront│──▶│ S3 Static  │   │  Cognito User Pool     │   │
│  │           │   │ (Angular)  │   │  + Client              │   │
│  │  /*       │   └────────────┘   └────────────────────────┘   │
│  │  /api/*  ─┼──▶┌────────────┐   ┌────────────────────────┐   │
│  │  /uploads─┼──▶│ S3 Images  │   │  DynamoDB              │   │
│  └───────────┘   └────────────┘   │  (VanderLeestContent)  │   │
│                                   └────────────────────────┘   │
│  ┌─────────────────────────────┐                               │
│  │ API Gateway (REST)          │                               │
│  │                             │                               │
│  │  Public:                    │   ┌────────────────────────┐   │
│  │   GET /api/content/{type}   │──▶│ content-api Lambda     │   │
│  │   GET /api/trailers         │   │ (Node.js 20)           │   │
│  │   GET /api/trailers/{slug}  │   └────────────────────────┘   │
│  │                             │                               │
│  │  Admin (Cognito auth):      │   ┌────────────────────────┐   │
│  │   PUT /api/admin/content/*  │──▶│ admin-api Lambda       │   │
│  │   POST /api/admin/trailers  │   │ (Node.js 20)           │   │
│  │   PUT /api/admin/trailers/* │   │                        │   │
│  │   DELETE /api/admin/trail.* │   │ + S3 pre-signed URLs   │   │
│  │   POST /api/admin/upload    │   └────────────────────────┘   │
│  └─────────────────────────────┘                               │
│                                                                 │
│  ┌─────────────────────────────┐                               │
│  │ Seed Lambda (Custom Res.)   │  Runs once on first deploy    │
│  │ Populates DynamoDB with     │  to seed all initial content  │
│  │ site-content.ts data        │                               │
│  └─────────────────────────────┘                               │
│                                                                 │
│  ┌─────────────────────────────┐                               │
│  │ BucketDeployment            │  Uploads Angular build to S3  │
│  │ + CloudFront invalidation   │  on every deploy              │
│  └─────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### CloudFront Routing

| Path Pattern | Origin | Auth | Caching |
|-------------|--------|------|---------|
| `/*` (default) | S3 Static Bucket | None | Default |
| `/api/*` | API Gateway | None/Cognito | Disabled (pass-through) |
| `/uploads/*` | S3 Images Bucket | None | Default |
| 404/403 errors | → `/index.html` (200) | — | 5 min TTL |

### Lambda Functions

**`content-api`** (public, no auth)
- `GET /api/content/{type}` — Query DynamoDB by partition key, return data
- `GET /api/trailers` — Query all items with `pk = TRAILER`
- `GET /api/trailers/{slug}` — Get single trailer by slug

**`admin-api`** (Cognito JWT required)
- `PUT /api/admin/content/{type}` — Upsert content by type
- `GET /api/admin/trailers` — List all trailers (admin view with metadata)
- `POST /api/admin/trailers` — Create trailer (auto-generates slug)
- `PUT /api/admin/trailers/{slug}` — Update trailer
- `DELETE /api/admin/trailers/{slug}` — Delete trailer
- `POST /api/admin/upload` — Generate pre-signed S3 upload URL (5 min expiry)

**`seed`** (runs once via CDK Custom Resource)
- Checks if DynamoDB table is empty
- If empty, writes all initial content from the original website
- Skips if data already exists (safe to redeploy)

---

## Content Data Model

Single DynamoDB table: `VanderLeestContent`

| Partition Key (`pk`) | Sort Key (`sk`) | Data |
|---------------------|----------------|------|
| `SITE_INFO` | `_` | Business info (name, phone, address, hours, logos, social) |
| `PAGE_HOME` | `_` | Home page content (hero, intro, services section) |
| `PAGE_ABOUT` | `_` | About page content (story, founder) |
| `SERVICES` | `_` | Services hero + array of service cards |
| `CUSTOM_TRAILERS` | `_` | Custom trailers hero + gallery array |
| `FINANCING` | `_` | Financing hero + partner array |
| `CONTACT` | `_` | Contact page hero + form config |
| `FAQ` | `_` | Array of question/answer objects |
| `REVIEWS` | `_` | Array of review objects |
| `BRANDS` | `_` | Array of brand objects |
| `CATEGORIES` | `_` | Array of category objects |
| `IMAGES` | `_` | Hero/icon/logo image URLs |
| `TRAILER` | `{slug}` | Individual trailer (name, category, brand, price, images, etc.) |

---

## Design System

### Aesthetic
Dark industrial-refined theme. Steel-dark backgrounds with blue accents. Confident, trustworthy, professional — appropriate for a trailer dealership.

### Colors (CSS variables in `styles.scss`)

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-bg` | `#0c0f12` | Page background |
| `--color-bg-elevated` | `#151a20` | Cards, sections |
| `--color-bg-card` | `#1a2029` | Card backgrounds |
| `--color-accent` | Defined in styles | Primary accent (buttons, links, highlights) |
| `--color-text` | `#eef0f2` | Primary text |
| `--color-text-secondary` | `#9aa3b0` | Body text |
| `--color-text-muted` | `#5e6878` | Subtle text |

### Typography

| Font | Usage |
|------|-------|
| **Outfit** (Google Fonts) | Headings, buttons, labels — weights 300–900 |
| **DM Sans** (Google Fonts) | Body text, paragraphs — weights 400, 500, 700 |

### Key Design Features
- **Grain texture overlay** — subtle SVG noise on `body::after` for depth
- **Sticky header** — transparent on top, solid with backdrop-blur on scroll
- **Accent glow** — `box-shadow` with accent color on hover states
- **Staggered animations** — `fadeInUp` with `animation-delay` classes (`.delay-1` through `.delay-6`)
- **Page hero pattern** — background image + dark gradient overlay + centered text
- **Responsive** — mobile-first with breakpoints at 640px, 768px, 1024px, 1100px
- **Custom scrollbar** — styled to match dark theme
- **View transitions** — Angular `withViewTransitions()` for smooth page changes

### Button Variants
- `.btn--primary` — accent background, dark text, glow shadow
- `.btn--outline` — accent border, transparent background
- `.btn--ghost` — subtle border, text color

### Images
All images reference the original WordPress media library at `vanderleesttrailers.com/wp-content/uploads/`. The logo is the full VanderLeest logo with blue text, trailer graphic, and "TRAILER SALES" subtitle. Custom favicon uses a "V" monogram with matching blue gradient.

---

## Local Development

```bash
# Install all dependencies (frontend + CDK)
npm run install:all

# Start dev server at http://localhost:4200
npm start
```

The public site works fully offline with static data from `site-content.ts`. The admin panel requires the AWS backend — it will redirect to login but won't authenticate without a deployed Cognito pool.

### Root Scripts (`package.json`)

| Script | What it does |
|--------|-------------|
| `npm start` | Runs `ng serve` in the frontend |
| `npm run build` | Production build of the frontend |
| `npm run install:frontend` | Install frontend dependencies |
| `npm run install:cdk` | Install CDK dependencies |
| `npm run install:all` | Install both |
| `npm run deploy` | Build frontend + `cdk deploy` |

---

## Build

```bash
npm run build
```

Output: `frontend/dist/frontend/browser/` (~377 KB initial, ~103 KB gzipped)

All page components are lazy-loaded, so the initial bundle only includes the shell (header, footer, router).

---

## AWS Deployment

### What the CDK stack creates

| Resource | Purpose |
|----------|---------|
| S3 Bucket (static) | Hosts Angular build files |
| S3 Bucket (images) | Stores uploaded images with CORS for direct upload |
| CloudFront Distribution | HTTPS CDN with 3 origins (static, API, images) + SPA routing |
| CloudFront OAI (x2) | Secure S3 access without public buckets |
| DynamoDB Table | `VanderLeestContent` — pay-per-request, single table design |
| Cognito User Pool + Client | Admin authentication (email/password, no self-signup) |
| Lambda: content-api | Public read API (Node.js 20, 256 MB, 10s timeout) |
| Lambda: admin-api | Admin CRUD API (Node.js 20, 256 MB, 15s timeout) |
| Lambda: seed | First-deploy data population (60s timeout) |
| API Gateway (REST) | Routes with Cognito authorizer on admin endpoints |
| BucketDeployment | Auto-uploads Angular build to S3 + invalidates CloudFront |
| Custom Resource | Triggers seed Lambda on first deploy |

All resources use `RemovalPolicy.DESTROY` for easy cleanup.

### Prerequisites

- AWS CLI configured with credentials (`aws configure`)
- Node.js 20+
- AWS CDK CLI: `npm install -g aws-cdk`

### First-Time Deploy

```bash
# 1. Install everything
npm run install:all

# 2. Build the frontend
npm run build

# 3. Bootstrap CDK (first time only)
cd cdk
npx cdk bootstrap

# 4. Deploy
npx cdk deploy
```

### Post-Deploy Setup

The deploy prints output values. Complete these steps:

**Step 1 — Update environment config**

Copy `UserPoolId` and `UserPoolClientId` from the CDK outputs into:
- `frontend/src/environments/environment.ts`
- `frontend/src/environments/environment.prod.ts`

**Step 2 — Create an admin user**

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username admin@vanderleesttrailers.com \
  --temporary-password TempPass123! \
  --user-attributes Name=email,Value=admin@vanderleesttrailers.com Name=email_verified,Value=true
```

**Step 3 — Rebuild and redeploy** with the Cognito config:

```bash
cd frontend && npx ng build --configuration production
cd ../cdk && npx cdk deploy
```

**Step 4 — Login** at `https://<CloudFrontURL>/admin/login` with the email and temporary password.

### Tear Down

```bash
cd cdk
npx cdk destroy
```

This deletes everything including S3 contents and DynamoDB data.

---

## GitHub Actions CI/CD

Two workflows in `.github/workflows/`:

### `deploy.yml` — Build & Deploy

**Triggers:** Push to `main`, manual dispatch

1. Checks out code
2. Sets up Node.js 20 with npm cache
3. Installs frontend dependencies
4. Writes environment config from GitHub Secrets
5. Builds Angular in production mode
6. Installs CDK dependencies
7. Assumes AWS role via OIDC federation (no access keys)
8. Runs `cdk deploy` and outputs the CloudFront URL

### `pr-check.yml` — PR Validation

**Triggers:** Pull requests to `main`

1. Builds the Angular frontend (catches compile errors)
2. Runs `cdk synth` (validates infrastructure is valid)
3. Uses stub environment — no AWS credentials needed

### Required GitHub Secrets

| Secret | Description | Where to get it |
|--------|-------------|-----------------|
| `AWS_ACCESS_KEY_ID` | IAM access key ID | AWS IAM console > Users > Security credentials |
| `AWS_SECRET_ACCESS_KEY` | IAM secret access key | Generated when creating the access key |
| `COGNITO_USER_POOL_ID` | Cognito pool ID | CDK deploy output: `UserPoolId` |
| `COGNITO_CLIENT_ID` | Cognito client ID | CDK deploy output: `UserPoolClientId` |

Set these in **GitHub repo > Settings > Secrets and variables > Actions**.

### Creating an IAM User for Deployments

1. Go to **AWS Console > IAM > Users > Create user**
2. Name it something like `github-deployer`
3. Attach the `AdministratorAccess` policy (or a scoped policy covering S3, CloudFront, DynamoDB, Lambda, API Gateway, Cognito, IAM, CloudFormation)
4. Go to **Security credentials > Create access key**
5. Choose "Third-party service", create the key
6. Copy the Access Key ID and Secret Access Key into your GitHub Secrets

---



## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 17 (standalone components, lazy-loaded routes, view transitions) |
| Styling | SCSS with CSS custom properties, Outfit + DM Sans fonts |
| Admin Auth | Amazon Cognito (email/password, JWT) |
| API | AWS API Gateway (REST) + Lambda (Node.js 20) |
| Database | Amazon DynamoDB (single table, pay-per-request) |
| File Storage | Amazon S3 (static site + image uploads) |
| CDN | Amazon CloudFront (HTTPS, SPA routing, 3 origins) |
| Infrastructure | AWS CDK v2 (TypeScript, single stack) |
| CI/CD | GitHub Actions (OIDC auth, auto-deploy on main) |
| Cognito SDK | `amazon-cognito-identity-js` |

