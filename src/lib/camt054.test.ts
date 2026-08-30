import { describe, it, expect } from "vitest";
import { parseCamt054 } from "@/lib/camt054";
const xml = `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.04"><BkToCstmrDbtCdtNtfctn><Ntfctn><Ntry><Amt Ccy="CHF">100.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-08-29</Dt></BookgDt><AcctSvcrRef>BR1</AcctSvcrRef><NtryDtls><TxDtls><Amt Ccy="CHF">100.00</Amt><RltdPties><Dbtr><Nm>Lea Grosjean</Nm></Dbtr></RltdPties><RmtInf><Strd><CdtrRefInf><Ref>210000000003139471430009017</Ref></CdtrRefInf></Strd></RmtInf></TxDtls></NtryDtls></Ntry><Ntry><Amt Ccy="CHF">50.00</Amt><CdtDbtInd>DBIT</CdtDbtInd></Ntry></Ntfctn></BkToCstmrDbtCdtNtfctn></Document>`;
describe("camt054", () => { it("parses", () => {
  const { entries } = parseCamt054(xml);
  expect(entries.length).toBe(2);
  expect(entries[0]!.reference).toBe("210000000003139471430009017");
  expect(entries[0]!.amount).toBe(100);
  expect(entries[0]!.debtor).toBe("Lea Grosjean");
  expect(entries[1]!.credit).toBe(false);
}); });
