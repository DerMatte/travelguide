#!/usr/bin/env tsx
/**
 * Review and enrich airport pages using the Cursor SDK (local agent).
 *
 * Usage:
 *   CURSOR_API_KEY=xxx pnpm review:airports
 *   CURSOR_API_KEY=xxx pnpm review:airports LHR
 *   CURSOR_API_KEY=xxx pnpm review:airports --changed-only
 */

import { Agent, CursorAgentError } from "@cursor/sdk";
import { buildAirportReviewPrompt } from "../lib/airport-review-brief";
import {
  clearPendingUpdate,
  getPendingUpdate,
  loadCommunityForumState,
} from "../lib/community-forum-sync";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function runReviewForAirport(iata: string) {
  const apiKey = requireApiKey();
  const pending = await getPendingUpdate(iata);

  const prompt = buildAirportReviewPrompt({
    iata,
    openPr: false,
    forumContext: pending
      ? {
          airportThreads: pending.threads,
          referenceThreads: pending.referenceThreads,
        }
      : undefined,
  });

  console.log(`Reviewing ${iata.toUpperCase()}…`);
  if (pending) {
    console.log(
      `  Forum context: ${pending.threads.length} airport thread(s), ${pending.referenceThreads.length} reference thread(s)`,
    );
  }

  const result = await Agent.prompt(prompt, {
    apiKey,
    model: { id: "composer-2.5" },
    name: `Review ${iata.toUpperCase()} airport page`,
    local: {
      cwd: process.cwd(),
      settingSources: [],
    },
  });

  if (result.status === "error") {
    throw new Error(`Review failed for ${iata}: ${result.id}`);
  }

  if (pending) {
    await clearPendingUpdate(iata);
  }

  console.log(`\nDone (${result.status}) — ${iata.toUpperCase()}`);
  if (result.result) {
    console.log("\n--- Agent summary ---\n");
    console.log(result.result);
  }
}

export async function reviewAirportsFromQueue() {
  requireApiKey();

  const state = await loadCommunityForumState();
  const queue = [...state.pending];

  if (queue.length === 0) {
    console.log("No airports queued from forum sync.");
    return;
  }

  console.log(`Reviewing ${queue.length} queued airport(s)…\n`);

  for (const entry of queue) {
    try {
      await runReviewForAirport(entry.iata);
    } catch (error) {
      if (error instanceof CursorAgentError) {
        console.error(`Startup failed: ${error.message} (retryable=${error.isRetryable})`);
        process.exit(1);
      }
      console.error(error);
      process.exit(2);
    }
  }
}

async function reviewAirportPages(iata?: string) {
  requireApiKey();

  if (iata) {
    console.log("Agent is running locally against this repo. This may take several minutes.\n");
    try {
      await runReviewForAirport(iata);
    } catch (error) {
      if (error instanceof CursorAgentError) {
        console.error(`Startup failed: ${error.message} (retryable=${error.isRetryable})`);
        process.exit(1);
      }
      throw error;
    }
    return;
  }

  const prompt = buildAirportReviewPrompt({ openPr: false });

  console.log("Reviewing all airport pages…");
  console.log("Agent is running locally against this repo. This may take several minutes.\n");

  try {
    const result = await Agent.prompt(prompt, {
      apiKey: process.env.CURSOR_API_KEY!,
      model: { id: "composer-2.5" },
      name: "Review airport pages",
      local: {
        cwd: process.cwd(),
        settingSources: [],
      },
    });

    if (result.status === "error") {
      console.error(`Run failed: ${result.id}`);
      process.exit(2);
    }

    console.log(`\nDone (${result.status}).`);
    if (result.result) {
      console.log("\n--- Agent summary ---\n");
      console.log(result.result);
    }
  } catch (error) {
    if (error instanceof CursorAgentError) {
      console.error(`Startup failed: ${error.message} (retryable=${error.isRetryable})`);
      process.exit(1);
    }
    throw error;
  }
}

function requireApiKey(): string {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey?.trim()) {
    console.error("Missing CURSOR_API_KEY. Add it to .env.local or export it in your shell.");
    console.error("Create a key at https://cursor.com/dashboard/integrations");
    process.exit(1);
  }
  return apiKey;
}

const args = process.argv.slice(2);
const isDirectRun = process.argv[1]?.includes("review-airport-pages");

if (isDirectRun) {
  const changedOnly = args.includes("--changed-only");
  const iataArg = args.find((arg) => !arg.startsWith("--"));

  if (changedOnly) {
    reviewAirportsFromQueue().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  } else {
    reviewAirportPages(iataArg).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
}
