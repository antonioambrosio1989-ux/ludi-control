import { adminDb } from '@/src/lib/firebaseAdmin';
import { mapMatch } from '@/src/lib/firestore/mappers/MatchDocumentMapper';
import type { CloudMatchReport } from '@/src/services/match/FirebaseMatchReportRepository';
import { verifyWithdrawalPublishedSnapshot } from '@/src/services/withdrawal/WithdrawalPublishedBoundaryRules';
import { getWithdrawalPublishedInputs } from '@/src/server/public/WithdrawalPublishedBoundary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const { seasonId } = await params;
  if (!/^[\w-]{1,128}$/.test(seasonId)) {
    return Response.json({ error: 'Stagione non valida.' }, { status: 400 });
  }
  try {
    const season = adminDb.collection('seasons').doc(seasonId);
    const [seasonDoc, registrationSnapshot, matchSnapshot, reportSnapshot] = await Promise.all([
      season.get(),
      season.collection('withdrawalRegistrations').get(),
      adminDb.collection('matches').where('seasonId', '==', seasonId).where('published', '==', true).get(),
      adminDb.collection('matchReports').where('seasonId', '==', seasonId).where('status', '==', 'published').get(),
    ]);
    if (!seasonDoc.exists) return Response.json({ error: 'Stagione non trovata.' }, { status: 404 });
    const registrations = verifyWithdrawalPublishedSnapshot(
      seasonId, registrationSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })),
    );
    const originalMatches = matchSnapshot.docs.map(doc => mapMatch(doc.id, doc.data()));
    const reports = reportSnapshot.docs.map(doc => doc.data() as CloudMatchReport);
    // Revalidate against the complete server-side register, ledger, awards and closures.
    const official = await getWithdrawalPublishedInputs({ seasonId, matches: originalMatches, reports });
    const original = new Map(originalMatches.map(m => [m.id, m]));
    const maturedWalkovers = official.matches.flatMap(match => {
      const source = original.get(match.id);
      if (!source || source.status !== 'scheduled' || match.status !== 'finished') return [];
      if (!((match.homeScore === 6 && match.awayScore === 0) ||
            (match.homeScore === 0 && match.awayScore === 6))) {
        throw new Error('Risultato tavolino non valido nel confine pubblico.');
      }
      return [{
        matchId: match.id,
        homeTeamId: String(match.homeTeamId),
        awayTeamId: String(match.awayTeamId),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      }];
    });
    const cancelledTeamIds = registrations
      .filter(reg => reg.state === 'active' && reg.effectsApplied && reg.policy === 'void_all')
      .map(reg => reg.teamId).sort();
    return Response.json({ seasonId, cancelledTeamIds, maturedWalkovers, verified: true }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Proiezione pubblica del ritiro non verificabile:', error);
    return Response.json({ error: 'Dati classifica temporaneamente non verificabili.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
