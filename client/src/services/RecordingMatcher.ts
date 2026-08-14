import { CallLogEntry } from '../types/CallLog.types';
import { CallRecordingFile } from '../types/Recording.types';
import {
  MAX_RECORDING_MATCH_WINDOW_MS,
  STRONG_TIME_ONLY_MATCH_MS,
} from '../config/syncConfig';
import { normalizeRemoteNumber } from '../utils/callHash';

function normalizeFileText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function usefulNameTokens(name: string): string[] {
  return String(name || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 4 && token !== 'unknown');
}

/**
 * Conservative OEM recording matcher.
 *
 * Android's call log row does not contain a recording-file path. OEM dialers
 * name/store recordings differently, so we only attach when filename/time
 * evidence is strong enough. A no-match is safer than attaching the wrong
 * person's audio; metadata will still sync.
 */
class RecordingMatcherClass {
  findMatchForCall(
    call: CallLogEntry,
    recordings: CallRecordingFile[],
    usedPaths = new Set<string>(),
  ): CallRecordingFile | null {
    if (call.duration <= 0) return null;

    const expectedEnd = call.timestamp + call.duration * 1000;
    const remoteDigits = normalizeRemoteNumber(call.remoteNumber);
    const phoneSuffix = remoteDigits === 'unknown' ? '' : remoteDigits.slice(-7);
    const nameTokens = usefulNameTokens(call.remoteName);

    const candidates = recordings
      .filter(recording => !usedPaths.has(recording.filePath))
      .map(recording => {
        const delta = Math.abs(recording.createdDate - expectedEnd);
        const normalizedName = normalizeFileText(recording.fileName);
        const numberMatch = Boolean(phoneSuffix && normalizedName.includes(phoneSuffix));
        const nameMatch = nameTokens.some(token => normalizedName.includes(token));
        return { recording, delta, numberMatch, nameMatch };
      })
      .filter(candidate => candidate.delta <= MAX_RECORDING_MATCH_WINDOW_MS)
      .sort((a, b) => {
        const aEvidence = Number(a.numberMatch) * 2 + Number(a.nameMatch);
        const bEvidence = Number(b.numberMatch) * 2 + Number(b.nameMatch);
        return bEvidence - aEvidence || a.delta - b.delta;
      });

    if (candidates.length === 0) return null;

    const best = candidates[0];
    if (best.numberMatch || best.nameMatch) {
      return best.recording;
    }

    // Time-only fallback is accepted only when very close and unambiguous.
    const second = candidates[1];
    const timeOnlyIsSafe =
      best.delta <= STRONG_TIME_ONLY_MATCH_MS &&
      (!second || second.delta - best.delta > STRONG_TIME_ONLY_MATCH_MS);

    return timeOnlyIsSafe ? best.recording : null;
  }
}

export const RecordingMatcher = new RecordingMatcherClass();
