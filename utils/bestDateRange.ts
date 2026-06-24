import { DateVote } from '../types';

export function getAvailableVoteCounts(votes: DateVote[]): Record<string, number> {
  const voteCounts: Record<string, number> = {};
  votes.forEach(v => {
    if (v.type === 'available') {
      voteCounts[v.date] = (voteCounts[v.date] || 0) + 1;
    }
  });
  return voteCounts;
}

export function getBestDates(votes: DateVote[]): string[] {
  const voteCounts = getAvailableVoteCounts(votes);
  const maxVotes = Math.max(...Object.values(voteCounts), 0);
  if (maxVotes === 0) return [];
  return Object.keys(voteCounts)
    .filter(d => voteCounts[d] === maxVotes)
    .sort();
}

export function groupContiguousDates(dates: string[]): string[][] {
  if (dates.length === 0) return [];

  const groups: string[][] = [[dates[0]]];

  for (let i = 1; i < dates.length; i++) {
    const [prevYear, prevMonth, prevDay] = dates[i - 1].split('-').map(Number);
    const [currYear, currMonth, currDay] = dates[i].split('-').map(Number);

    const prevDateObj = new Date(prevYear, prevMonth - 1, prevDay);
    const currDateObj = new Date(currYear, currMonth - 1, currDay);
    const daysDiff = (currDateObj.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff === 1) {
      groups[groups.length - 1].push(dates[i]);
    } else {
      groups.push([dates[i]]);
    }
  }

  return groups;
}

export function getLongestContiguousRange(
  dates: string[]
): { startDate: string; endDate: string } | null {
  const groups = groupContiguousDates(dates);
  if (groups.length === 0) return null;

  const longest = groups.reduce((a, b) => (a.length >= b.length ? a : b));
  return {
    startDate: longest[0],
    endDate: longest[longest.length - 1],
  };
}
