import { db } from "../server/db";
import { activityLogs, quotes } from "../shared/schema";
import { eq, and, isNull, desc, sql, gte, lte } from "drizzle-orm";

interface MatchResult {
  logId: string;
  quoteId: string | null;
  quoteNumber: string | null;
  matchType: 'session_id' | 'user_time_proximity' | 'no_match';
  confidence: 'high' | 'medium' | 'low' | 'none';
}

async function findUnlinkedCalculations() {
  const results = await db
    .select()
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.action, 'estimate.calculated'),
        sql`${activityLogs.details}->>'linkedQuoteId' IS NULL`
      )
    )
    .orderBy(desc(activityLogs.createdAt));
  
  return results;
}

async function findQuoteBySessionId(sessionId: string) {
  const results = await db
    .select()
    .from(quotes)
    .where(sql`${quotes.id}::text IN (
      SELECT DISTINCT q.id::text FROM quotes q 
      WHERE EXISTS (
        SELECT 1 FROM activity_logs al 
        WHERE al.action = 'estimate.calculated' 
        AND al.details->>'quoteSessionId' = ${sessionId}
        AND al.details->>'linkedQuoteId' = q.id::text
      )
    )`)
    .limit(1);
  
  return results[0] || null;
}

async function findQuoteByUserAndTime(userId: string | null, calcTime: Date) {
  if (!userId) return null;
  
  const windowMinutes = 30;
  const minTime = new Date(calcTime.getTime());
  const maxTime = new Date(calcTime.getTime() + windowMinutes * 60 * 1000);
  
  const results = await db
    .select()
    .from(quotes)
    .where(
      and(
        eq(quotes.userId, userId),
        gte(quotes.createdAt, minTime),
        lte(quotes.createdAt, maxTime)
      )
    )
    .orderBy(quotes.createdAt)
    .limit(1);
  
  return results[0] || null;
}

async function backfillLinks(dryRun: boolean = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Backfill Calculation Links - ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  console.log(`${'='.repeat(60)}\n`);

  const unlinkedLogs = await findUnlinkedCalculations();
  console.log(`Found ${unlinkedLogs.length} unlinked calculation logs\n`);

  const results: MatchResult[] = [];
  let matchedBySession = 0;
  let matchedByProximity = 0;
  let noMatch = 0;

  for (const log of unlinkedLogs) {
    const details = log.details as any || {};
    const sessionId = details.quoteSessionId;
    
    let matchedQuote = null;
    let matchType: MatchResult['matchType'] = 'no_match';
    let confidence: MatchResult['confidence'] = 'none';

    if (sessionId) {
      const allQuotes = await db.select().from(quotes).orderBy(desc(quotes.createdAt)).limit(100);
      for (const quote of allQuotes) {
        const calcLogsForQuote = await db
          .select()
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.action, 'estimate.calculated'),
              sql`${activityLogs.details}->>'quoteSessionId' = ${sessionId}`,
              sql`${activityLogs.details}->>'linkedQuoteId' = ${quote.id}`
            )
          )
          .limit(1);
        
        if (calcLogsForQuote.length > 0) {
          matchedQuote = quote;
          matchType = 'session_id';
          confidence = 'high';
          break;
        }
      }
    }

    if (!matchedQuote && log.userId) {
      matchedQuote = await findQuoteByUserAndTime(log.userId, new Date(log.createdAt));
      if (matchedQuote) {
        matchType = 'user_time_proximity';
        confidence = 'medium';
      }
    }

    if (matchedQuote) {
      if (matchType === 'session_id') {
        matchedBySession++;
      } else {
        matchedByProximity++;
      }

      console.log(`[MATCH] Log ${log.id.substring(0, 8)}... → Quote #${matchedQuote.quoteNumber} (${matchType}, ${confidence})`);
      console.log(`        Created: ${log.createdAt} | Volume: ${details.loadRequirements?.totalVolume?.toFixed(2) || '?'} m³`);

      if (!dryRun) {
        const mergedDetails = {
          ...details,
          linkedQuoteId: matchedQuote.id,
          linkedQuoteNumber: matchedQuote.quoteNumber,
          linkedAt: new Date().toISOString(),
          autoLinked: true,
          backfillBatch: new Date().toISOString(),
        };

        await db
          .update(activityLogs)
          .set({ details: mergedDetails })
          .where(eq(activityLogs.id, log.id));
        
        console.log(`        ✓ Linked successfully`);
      }
    } else {
      noMatch++;
      console.log(`[NO MATCH] Log ${log.id.substring(0, 8)}... - No matching quote found`);
      console.log(`           Created: ${log.createdAt} | User: ${log.userId?.substring(0, 8) || 'anonymous'}...`);
    }

    results.push({
      logId: log.id,
      quoteId: matchedQuote?.id || null,
      quoteNumber: matchedQuote?.quoteNumber || null,
      matchType,
      confidence,
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total unlinked logs:     ${unlinkedLogs.length}`);
  console.log(`Matched by session ID:   ${matchedBySession}`);
  console.log(`Matched by proximity:    ${matchedByProximity}`);
  console.log(`No match found:          ${noMatch}`);
  console.log(`${'='.repeat(60)}\n`);

  if (dryRun && (matchedBySession > 0 || matchedByProximity > 0)) {
    console.log(`To apply these changes, run: npx tsx scripts/backfill-calculation-links.ts --apply\n`);
  }

  return results;
}

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');

backfillLinks(!shouldApply)
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
