export const TARGET_MESSAGES = 1_000_000;
export const EXECUTION_THRESHOLD = Math.floor(TARGET_MESSAGES * 0.50069); // 500,690

/**
 * The forum is built and skinned, but hidden until there are enough people to
 * make an argument worth reading. Flip this to true and the page and its links
 * come back; nothing else needs to change.
 */
export const FORUM_ENABLED = false;
