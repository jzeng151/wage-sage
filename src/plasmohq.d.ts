/**
 * Type declarations for the plasmo framework.
 * Plasmo exports runtime helpers for content script configuration
 * and extension lifecycle, but doesn't ship standalone .d.ts files.
 */
declare module "plasmohq" {
  /** Configuration object exported from content scripts to control injection. */
  export interface PlasmoCSConfig {
    /** URL patterns where the content script should be injected. */
    matches: string[];
    /** Run the content script at document_idle (default), document_start, or document_end. */
    run_at?: "document_start" | "document_end" | "document_idle";
    /** Exclude URL patterns from injection. */
    exclude_matches?: string[];
    /** CSS files to inject alongside the script. */
    css?: string[];
  }
}
