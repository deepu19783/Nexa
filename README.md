
# Nexa AI

A local AI chat app built with HTML, CSS, JavaScript and Node.js. Supabase handles login and saved chat history; the local Node server calls the configured AI provider.

## Supabase setup

1. Configure the project URL and publishable key in `js/supabase.js`.
2. In the Supabase SQL Editor, run `supabase/schema.sql` to create the chat tables and security policies. Run it again after updating this file so message-history inserts are enabled.
3. Enable email/password sign-up in Supabase Authentication if it is not already enabled.

## Add API keys

Create keys from the provider consoles and put them in the project `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

Either key is enough. If both are configured, Gemini is tried first, then Groq if Gemini fails. Their free tiers have rate limits and model availability can change.

OpenAI is optional and may incur charges. It is only used as a last-resort fallback if you explicitly set both `OPENAI_API_KEY` and `ENABLE_PAID_OPENAI_FALLBACK=true` in `.env`.

Keep `.env` private. Never put provider keys in browser JavaScript or share them in chat. If a key was exposed, revoke it and create a replacement.

## Get keys

- Gemini: https://aistudio.google.com/apikey
- Groq: https://console.groq.com/keys
- OpenAI (optional, paid): https://platform.openai.com/api-keys

Free-tier limits and terms are controlled by each provider. Check the current [Gemini pricing and limits](https://ai.google.dev/gemini-api/docs/pricing) and [Groq rate limits](https://console.groq.com/docs/rate-limits).

## Run locally

1. Copy `.env.example` to `.env` and add at least one Gemini or Groq key.
2. In this folder, run `npm start`.
3. Open http://127.0.0.1:3000. Do not use Live Server; it cannot serve the chat API.

Create an account through the Login / Sign up link. Chats are saved to Supabase and can be reopened from the sidebar.

## Deploy on Netlify

1. Push the project to a GitHub repository. `.env` is ignored by Git; never commit or upload it.
2. In Netlify, choose **Add new site** and import that repository.
3. Use build command `npm run build` and publish directory `dist`. `netlify.toml` configures these and the `/api/chat` function route.
4. In the Netlify site's environment variables, add `GEMINI_API_KEY` and/or `GROQ_API_KEY`. Keep `ENABLE_PAID_OPENAI_FALLBACK` set to `false`; do not add `OPENAI_API_KEY` unless you deliberately want paid fallback.
5. Deploy the site. Netlify will show its public `*.netlify.app` URL.
6. In Supabase Authentication URL Configuration, set the Site URL to that Netlify URL and add `https://YOUR-SITE.netlify.app/**` to the allowed redirect URLs. Replace `YOUR-SITE` with your actual Netlify subdomain.
7. To request Google Search indexing, add the deployed domain to Google Search Console and submit the homepage for indexing. Search listing is not immediate or guaranteed.

Provider keys belong in Netlify environment variables for the deployed site, not in frontend JavaScript or the repository's `.env.example`.
