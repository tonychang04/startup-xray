# Startup X-Ray

VC-Style Analysis in Seconds - Know any startup or founder before you meet them.

## Overview

Startup X-Ray provides instant venture insights for founders, VCs, and investors. The platform helps you analyze and compare startups with AI-powered intelligence, giving you comprehensive business metrics and visualizations in seconds. No matter if you're a founder, investor, or just curious, Startup X-Ray is your go-to tool for quick and accurate business analysis.

## Features

- **Analyze**: Get detailed analysis of any startup or business
- **Compare**: Evaluate multiple businesses side-by-side with VC-style metrics
- **Instant Insights**: Generate comprehensive reports in seconds
- **Interactive Visualizations**: View key metrics through intuitive charts
- **Key Differences**: Understand the main differentiators between compared businesses
- **User Authentication**: Secure access with Google authentication

## Getting Started

Developing locally:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

For Production:
https://www.startupxray.com/

## Technology Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Charts**: Chart.js
- **Form Handling**: React Hook Form with Zod validation
- **Authentication**: Firebase Authentication
- **AI Integration**: Perplexity AI API

## Project Structure

- `/app`: Next.js app router pages and components
- `/app/compare`: Business comparison feature
- `/api`: Backend API routes
- `/api/perplexity`: AI integration endpoints
- `/hooks`: Custom React hooks
- `/components`: Reusable UI components

## Learn More

To learn more about the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Chart.js](https://www.chartjs.org/)
- [Firebase Authentication](https://firebase.google.com/docs/auth)

## Deployment

The easiest way to deploy this application is to use the [Vercel Platform](https://vercel.com/new) from the creators of Next.js.
