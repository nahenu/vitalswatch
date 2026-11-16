const vercelProduction = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

export const site = {
  name: "VitalsWatch",
  url: process.env.NEXT_PUBLIC_SITE_URL || (vercelProduction ? `https://${vercelProduction}` : "http://localhost:3001"),
  repo: "https://github.com/nahenu/vitalswatch",
  author: "Arpit Goyal",
} as const;
