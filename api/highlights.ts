import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

const client = new Anthropic();

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { teamName, opponent, gameDate, homeScore, awayScore, playerStats, pitcherStats } = await req.json();

  const won = homeScore > awayScore;
  const tied = homeScore === awayScore;
  const result = won ? 'win' : tied ? 'tie' : 'loss';

  const playerLines = playerStats
    .filter((p: { abs: number; hits: number; runs: number; rbis: number; sbs: number }) =>
      p.abs > 0 || p.runs > 0 || p.rbis > 0 || p.sbs > 0
    )
    .map((p: { name: string; jersey: number | null; hits: number; abs: number; runs: number; rbis: number; sbs: number; walks: number; ks: number }) =>
      `${p.name}${p.jersey !== null ? ` (#${p.jersey})` : ''}: ${p.hits}/${p.abs} AB, ${p.runs} R, ${p.rbis} RBI, ${p.sbs} SB, ${p.walks} BB, ${p.ks} K`
    )
    .join('\n');

  const pitcherLines = pitcherStats
    .filter((p: { count: number }) => p.count > 0)
    .map((p: { name: string; jersey: number | null; count: number }) =>
      `${p.name}${p.jersey !== null ? ` (#${p.jersey})` : ''}: ${p.count} pitches`
    )
    .join('\n');

  const prompt = `You are writing a short, upbeat game recap text message for little league parents (ages 7-8, Rookies Division).

Game: ${teamName} vs. ${opponent}
Date: ${gameDate}
Score: ${teamName} ${homeScore}, ${opponent} ${awayScore} (${result})

Player stats:
${playerLines || 'No at-bats recorded.'}

Pitchers:
${pitcherLines || 'No pitching data.'}

Write a warm, encouraging recap text message a coach would send to the parent group chat. Rules:
- 1 opening line with the result and score
- 3-4 bullet point highlights (pick the standout moments — best AVG, most RBIs, runs, stolen bases, strong pitching)
- If it's a loss, keep it positive and focus on effort and bright spots — never mention who struck out or made errors
- 1 short closing line ending with "See everyone at the next practice! ⚾"
- Keep it under 200 words
- Use plain text only, no markdown, no asterisks, no bold
- Use the player's first name only`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  return new Response(JSON.stringify({ text }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
