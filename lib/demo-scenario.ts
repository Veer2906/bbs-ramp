// Public starting instructions only. Credentials and fixture expectations stay server-side.
//
// Each prompt is a short ask, the way someone would type it. The saved finance rules do the rest:
// they set the close period, hold bank-change notices, count each bank payment once, and tell the
// agent to ask before picking a warehouse.
export const DEMO_PROMPT = `Can you do the October close for Brightline? Go through Northwind, Contoso and Acme, pull everything for the month, match it to the ledger and flag whatever looks off. At the end, tell me what I need to decide.`;
