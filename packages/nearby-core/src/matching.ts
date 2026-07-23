import { haversineMeters, toGcj02 } from "./geo.ts";
import { formatSharedDistance, isLocationFresh, negotiateDistancePrecision } from "./privacy.ts";
import type { GeoPoint, NearbyMatch, PlayerProfile, PresenceSnapshot } from "./types.ts";

export interface FindNearbyMatchesInput {
  me: PlayerProfile;
  myLocation: GeoPoint;
  candidates: PresenceSnapshot[];
  now?: Date;
  mutuallyMatchedIds?: ReadonlySet<string>;
}

function sharedInterests(mine: string[], theirs: string[]): string[] {
  const theirsSet = new Set(theirs.map((interest) => interest.trim().toLocaleLowerCase()));
  return mine.filter((interest) => theirsSet.has(interest.trim().toLocaleLowerCase()));
}

function calculateScore(sharedCount: number, totalInterestCount: number, distance: number, radius: number): number {
  const interestScore = sharedCount / Math.max(totalInterestCount, 1);
  const distanceScore = Math.max(0, 1 - distance / Math.max(radius, 1));
  return Math.round(Math.min(1, interestScore * 0.65 + distanceScore * 0.35) * 100);
}

export function findNearbyMatches({
  me,
  myLocation,
  candidates,
  now = new Date(),
  mutuallyMatchedIds = new Set<string>(),
}: FindNearbyMatchesInput): NearbyMatch[] {
  if (!me.discoverable || !isLocationFresh(myLocation.capturedAt, now)) {
    return [];
  }

  const normalizedMine = toGcj02(myLocation);
  const matches: NearbyMatch[] = [];

  for (const candidate of candidates) {
    if (candidate.profile.id === me.id || !candidate.profile.discoverable) {
      continue;
    }
    if (!isLocationFresh(candidate.location.capturedAt, now)) {
      continue;
    }

    const common = sharedInterests(me.interests, candidate.profile.interests);
    if (common.length === 0) {
      continue;
    }

    const distanceMeters = haversineMeters(normalizedMine, toGcj02(candidate.location));
    const effectiveRadius = Math.min(me.discoveryRadiusMeters, candidate.profile.discoveryRadiusMeters);
    if (distanceMeters > effectiveRadius) {
      continue;
    }

    const matched = mutuallyMatchedIds.has(candidate.profile.id);
    const precision = negotiateDistancePrecision(
      me.distancePrecision,
      candidate.profile.distancePrecision,
      matched,
    );
    const totalInterests = new Set([...me.interests, ...candidate.profile.interests]).size;

    matches.push({
      player: candidate.profile,
      distanceMeters,
      displayDistance: formatSharedDistance(distanceMeters, precision),
      sharedInterests: common,
      score: calculateScore(common.length, totalInterests, distanceMeters, effectiveRadius),
      reason: `你们都喜欢${common.join("、")}，现在就在同一片区域。`,
      locationFresh: true,
    });
  }

  return matches.sort((left, right) => right.score - left.score || left.distanceMeters - right.distanceMeters);
}
