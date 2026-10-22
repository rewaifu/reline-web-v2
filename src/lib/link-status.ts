import { signal } from "reze-js";
import { probeLink, type LinkProbe, type LinkReport } from "./link-probe";

/**
 * The last answer about the link to the runner, shared by whoever asks: the Run
 * tab's status line (on demand and as the address is typed) and the run client
 * (every retry while a run is being followed). One place, so the panel shows
 * what the client just learned instead of asking the same question twice.
 */
let current = signal<LinkReport | undefined>(undefined);
let checking = signal(false);
/** Bumped per check: an answer that arrives after a newer question is stale. */
let latest = 0;

/** The newest report, for any address — compare `url` with the address in use. */
export const linkReport = (): LinkReport | undefined => current;
export const linkChecking = (): boolean => checking;

/** Remember a report that someone else obtained. */
export const setLinkReport = (report: LinkReport): void => {
  latest += 1;
  checking = false;
  current = report;
};

/** Ask the link now. The newest question wins; an older answer is dropped. */
export const checkLink = async (
  url: string,
  probe: LinkProbe = probeLink,
): Promise<LinkReport | undefined> => {
  latest += 1;
  const mine = latest;
  checking = true;
  try {
    const report = await probe(url);
    if (mine !== latest) return undefined;
    current = report;
    return report;
  } finally {
    if (mine === latest) checking = false;
  }
};
