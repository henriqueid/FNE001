import { createHash, randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

loadEnvFile(".env.local");

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL não foi configurada.");

const args = Object.fromEntries(
  process.argv.slice(2).map(argument => {
    const [key, ...value] = argument.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);
const required = ["cedentes", "sacados", "titulos"];
for (const key of required) if (!args[key]) throw new Error(`Informe --${key}=caminho-do-arquivo.csv`);

const tenantId = args.tenant || process.env.NEXT_PUBLIC_STRATO_TENANT_ID?.trim() || "strato-demo";
const sourceSystem = args.source || "LEGACY_PORTFOLIO_EXPORT";
const decoder = new TextDecoder("windows-1252");

function csvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ";") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.length > 1 || row[0]) rows.push(row.at(-1) === "" ? row.slice(0, -1) : row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row.at(-1) === "" ? row.slice(0, -1) : row);
  }
  return rows;
}

const digits = value => (value ?? "").replace(/\D/g, "");
const hash = value => createHash("sha256").update(value).digest("hex");
const formatDocument = value => {
  const document = digits(value);
  return document.length === 11
    ? document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};
const parseDate = value => {
  if (!value) return null;
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
};
const dateValue = value => new Date(`${value}T00:00:00Z`);
const cents = value => {
  const normalized = (value || "0").trim().replace(/\./g, "").replace(",", ".");
  const [integer = "0", decimals = ""] = normalized.split(".");
  return BigInt(integer || "0") * 100n + BigInt((decimals + "00").slice(0, 2));
};
const databaseCents = value => {
  const normalized = String(value || "0").trim();
  const [integer = "0", decimals = ""] = normalized.split(".");
  return BigInt(integer || "0") * 100n + BigInt((decimals + "00").slice(0, 2));
};
const decimal = value => {
  const amount = cents(value);
  return `${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`;
};
const validCpf = value => {
  const document = digits(value);
  if (document.length !== 11 || /^(\d)\1+$/.test(document)) return false;
  for (const length of [9, 10]) {
    const sum = [...document.slice(0, length)].reduce(
      (total, number, index) => total + Number(number) * (length + 1 - index),
      0,
    );
    if (((sum * 10) % 11) % 10 !== Number(document[length])) return false;
  }
  return true;
};
const validCnpj = value => {
  const document = digits(value);
  if (document.length !== 14 || /^(\d)\1+$/.test(document)) return false;
  for (const [length, weights] of [
    [12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]],
    [13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]],
  ]) {
    const sum = weights.reduce((total, weight, index) => total + Number(document[index]) * weight, 0);
    const remainder = sum % 11;
    if ((remainder < 2 ? 0 : 11 - remainder) !== Number(document[length])) return false;
  }
  return true;
};
const chunks = (items, size = 400) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

const files = {};
for (const key of required) {
  const bytes = await readFile(args[key]);
  files[key] = { bytes, digest: hash(bytes), rows: csvRows(decoder.decode(bytes)) };
}
const cedentRows = files.cedentes.rows.slice(1);
const debtorRows = files.sacados.rows.slice(1);
const titleRows = files.titulos.rows.slice(1);

const invalidParties = [];
const partiesByDocument = new Map();
const sourceRefs = [];
const roleStates = [];
const normalizedStatus = value =>
  value === "A" ? "ACTIVE" : value === "I" ? "INACTIVE" : value === "B" ? "BLOCKED" : "UNKNOWN";

function addParty(row, role) {
  const [externalCode, name, rawDocument, kind] = row;
  const sourceStatus = row[role === "cedente" ? 5 : 4];
  const document = digits(rawDocument);
  const validDocument = kind === "F" ? validCpf(document) : kind === "J" ? validCnpj(document) : false;
  const validName = name.trim().length >= 2;
  if (!validDocument || !validName) {
    invalidParties.push({
      externalCode,
      name,
      rawDocument,
      kind,
      role,
      sourceStatus,
      issueCode: !validDocument ? "INVALID_DOCUMENT" : "INVALID_NAME",
    });
    return;
  }
  const current = partiesByDocument.get(document) ?? {
    partyId: `pty-${document}`,
    document,
    kind: kind === "F" ? "PF" : "PJ",
    name,
    roles: new Set(),
    sources: [],
  };
  current.roles.add(role);
  current.sources.push({ sourceRole: role.toUpperCase(), externalCode, sourceStatus, rawName: name });
  partiesByDocument.set(document, current);
}
cedentRows.forEach(row => addParty(row, "cedente"));
debtorRows.forEach(row => addParty(row, "sacado"));

const positionDate =
  args["position-date"] ||
  titleRows
    .map(row => parseDate(row[34]))
    .filter(Boolean)
    .sort()
    .at(-1);
if (!positionDate) throw new Error("Não foi possível determinar a data-base do arquivo de títulos.");

const manifest = required.map(key => ({
  kind: key,
  sha256: files[key].digest,
  bytes: files[key].bytes.length,
  records: files[key].rows.length - 1,
}));
const batchId = `portfolio:${positionDate}:${hash(manifest.map(item => item.sha256).join("|")).slice(0, 24)}`;
const now = new Date().toISOString();

const parties = [...partiesByDocument.values()].map(party => {
  const roles = [...party.roles].sort();
  const active = party.sources.some(source => source.sourceStatus === "A");
  const roleData = {};
  if (roles.includes("cedente"))
    roleData.cedente = {
      creditLimit: 0,
      monthlyRate: 0,
      repId: "",
      managerId: "",
      contractUntil: "",
      guarantee: "Com regresso",
      operationalOverrides: {},
      tranches: [],
      compliance: {
        kycStatus: "Pendente",
        coafQualified: false,
        politicallyExposed: false,
        beneficialOwnerIdentified: false,
        sanctionsCheckedAt: "",
        registrationReviewAt: "",
        creditReviewAt: "",
      },
    };
  if (roles.includes("sacado")) roleData.sacado = { creditLimit: 0, confirmationContact: "" };
  return {
    tenant_id: tenantId,
    party_id: party.partyId,
    kind: party.kind,
    document_digits: party.document,
    name: party.name,
    trade_name: "",
    status: active ? "Ativo" : "Inativo",
    roles,
    payload: {
      id: party.partyId,
      kind: party.kind,
      document: formatDocument(party.document),
      name: party.name,
      tradeName: "",
      birthOrFoundation: "",
      stateRegistration: "",
      email: "",
      phone: "",
      address: { zipCode: "", street: "", number: "", complement: "", district: "", city: "", state: "" },
      contacts: [],
      bankAccounts: [],
      roles,
      roleData,
      status: active ? "Ativo" : "Inativo",
      inactiveReason: active ? undefined : "Situação inativa no sistema de origem",
      notes: "Importado da base histórica; dados cadastrais externos ainda não consultados.",
      origin: "Importação",
      createdAt: positionDate,
      updatedAt: positionDate,
      history: [{ at: now, by: "Importação STRATO", action: "Cadastro importado", origin: sourceSystem }],
    },
  };
});

for (const party of partiesByDocument.values()) {
  for (const source of party.sources) {
    sourceRefs.push({
      tenant_id: tenantId,
      source_system: sourceSystem,
      source_role: source.sourceRole,
      external_code: source.externalCode,
      party_id: party.partyId,
      source_status: source.sourceStatus,
      raw_name: source.rawName,
      import_batch_id: batchId,
    });
    roleStates.push({
      tenant_id: tenantId,
      party_id: party.partyId,
      role: source.sourceRole.toLowerCase(),
      source_status: source.sourceStatus,
      normalized_status: normalizedStatus(source.sourceStatus),
      import_batch_id: batchId,
    });
  }
}

const cedentByCode = new Map(
  sourceRefs.filter(ref => ref.source_role === "CEDENTE").map(ref => [ref.external_code, ref]),
);
const debtorByCode = new Map(
  sourceRefs.filter(ref => ref.source_role === "SACADO").map(ref => [ref.external_code, ref]),
);
let faceTotal = 0n;
let openTotal = 0n;
const titles = [];
const positions = [];
const qualityIssues = invalidParties.map(party => ({
  tenant_id: tenantId,
  issue_id: `dq:${batchId}:party:${party.role}:${party.externalCode}`,
  import_batch_id: batchId,
  entity_type: "PARTY_SOURCE",
  entity_id: `${party.role}:${party.externalCode}`,
  issue_code: party.issueCode,
  severity: "BLOCKING",
  status: "OPEN",
  details: {
    ...party,
    recommendation:
      party.issueCode === "INVALID_DOCUMENT"
        ? "Corrigir o documento no cadastro de origem antes de criar a identidade canônica."
        : "Corrigir a razão social no cadastro de origem antes de criar a identidade canônica.",
  },
}));

for (let index = 0; index < titleRows.length; index += 1) {
  const row = titleRows[index];
  if (row.length !== 46) throw new Error(`Título da linha ${index + 2} possui ${row.length} colunas; esperado: 46.`);
  const cedent = cedentByCode.get(row[0]);
  const debtor = debtorByCode.get(row[2]);
  if (!cedent || !debtor) throw new Error(`Vínculo ausente no título da linha ${index + 2}.`);
  const originalAmount = decimal(row[10]);
  const openAmount = decimal(row[11]);
  const canonicalSource = [row[0], row[2], row[7], row[28], row[9], originalAmount].join("|");
  const canonicalKey = hash(canonicalSource);
  const titleId = `pt-${canonicalKey.slice(0, 32)}`;
  const currentDueDate = parseDate(row[9]);
  const originalDueDate = parseDate(row[35]);
  const negotiationDate = parseDate(row[34]);
  const liquidationDate = parseDate(row[22]);
  const delay = Math.max(0, Math.floor((dateValue(positionDate) - dateValue(currentDueDate)) / 86_400_000));
  faceTotal += cents(row[10]);
  openTotal += cents(row[11]);
  const type =
    row[38] === "DM"
      ? "DUPLICATA_MERCANTIL"
      : row[38] === "NP"
        ? "NOTA_PROMISSORIA"
        : row[38] === "CH"
          ? "CHEQUE"
          : row[38] || "OUTRO";
  titles.push({
    tenant_id: tenantId,
    title_id: titleId,
    canonical_key: canonicalKey,
    cedent_party_id: cedent.party_id,
    debtor_party_id: debtor.party_id,
    source_cedent_code: row[0],
    source_debtor_code: row[2],
    document_number: row[7],
    source_sequence: row[28],
    receivable_type: type,
    negotiation_date: negotiationDate,
    original_due_date: originalDueDate,
    current_due_date: currentDueDate,
    original_amount: originalAmount,
    wallet_code: row[29],
    internal_wallet: row[30],
    economic_group: row[41].trim(),
    payload: {
      sourceCedentName: row[1],
      sourceDebtorName: row[3],
      phones: [row[4], row[5], row[6]].filter(Boolean),
      businessAgentCode: row[14],
      businessAgent: row[15],
      additionalNumber: row[37],
      endorsement: row[33],
      label: row[36],
      structuredCreditOperation: row[45],
      sourceSystem,
    },
  });
  positions.push({
    tenant_id: tenantId,
    import_batch_id: batchId,
    title_id: titleId,
    position_date: positionDate,
    source_status: row[8],
    lifecycle_status: row[8] === "ABERTO" ? "OPEN" : row[8] === "BAIXADO" ? "SETTLED" : "UNKNOWN",
    open_amount: openAmount,
    present_amount: decimal(row[17]),
    paid_amount: decimal(row[21]),
    discount_amount: decimal(row[16]),
    discount_income: decimal(row[13]),
    late_fee_amount: decimal(row[18]),
    monetary_correction_amount: decimal(row[19]),
    source_delay_days: Number(row[12]) || 0,
    computed_days_past_due: delay,
    collection_agreement: row[20].trim().toUpperCase() === "SIM",
    collection_status: row[40],
    score: row[43] ? Number(row[43].replace(",", ".")) : null,
    liquidation_date: liquidationDate,
    payload: { flags: { ai: row[23], c: row[24], p: row[25], e: row[26], m: row[27] }, status: row[42], ur: row[44] },
  });
  if (row[8] === "BAIXADO" && !liquidationDate)
    qualityIssues.push({
      tenant_id: tenantId,
      issue_id: `dq:${batchId}:title:${titleId}:missing-liquidation`,
      import_batch_id: batchId,
      entity_type: "PORTFOLIO_TITLE",
      entity_id: titleId,
      issue_code: "MISSING_LIQUIDATION_DATE",
      severity: "WARNING",
      status: "OPEN",
      details: { sourceLine: index + 2, sourceStatus: row[8], documentNumber: row[7] },
    });
}

const controlTotals = {
  cedentRecords: cedentRows.length,
  debtorRecords: debtorRows.length,
  uniqueValidParties: parties.length,
  quarantinedParties: invalidParties.length,
  titleRecords: titles.length,
  originalAmount: decimal(String(faceTotal / 100n) + "," + String(faceTotal % 100n).padStart(2, "0")),
  openAmount: decimal(String(openTotal / 100n) + "," + String(openTotal % 100n).padStart(2, "0")),
};

const sql = postgres(connectionString, {
  max: 2,
  connect_timeout: 15,
  idle_timeout: 30,
  prepare: false,
  ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
});

try {
  const existing = await sql`
    select status, result_counts from private.import_batches
    where tenant_id = ${tenantId} and batch_id = ${batchId}
  `;
  if (existing[0]?.status === "COMPLETED") {
    console.log(JSON.stringify({ batchId, status: "ALREADY_COMPLETED", result: existing[0].result_counts }));
    process.exitCode = 0;
  } else {
    const result = await sql.begin(async transaction => {
      // A posição importada não pode mudar entre a leitura do saldo e uma liquidação no servidor.
      await transaction`select pg_advisory_xact_lock(hashtextextended(${`strato.finance:${tenantId}`}, 0))`;
      const actors = await transaction`
        select u.user_id
        from private.access_users u
        join private.tenant_memberships m on m.user_id = u.user_id
        where m.tenant_id = ${tenantId} and u.status = 'active'
        order by case when u.access_level = 'admin' then 0 else 1 end, u.created_at
        limit 1
      `;
      const actorId = actors[0]?.user_id;
      if (!actorId) throw new Error(`Nenhum usuário ativo encontrado para o tenant ${tenantId}.`);
      await transaction`
        insert into private.import_batches
          (tenant_id, batch_id, import_type, source_system, position_date, status, file_manifest,
           control_totals, result_counts, quality_summary, created_by)
        values (${tenantId}, ${batchId}, 'PORTFOLIO_SNAPSHOT', ${sourceSystem}, ${positionDate}, 'IMPORTING',
          ${transaction.json(manifest)}, ${transaction.json(controlTotals)}, '{}'::jsonb,
          ${transaction.json({ openIssues: qualityIssues.length })}, ${actorId})
      `;
      for (const part of chunks(parties)) {
        const records = part.map(item => ({
          ...item,
          payload: transaction.json(item.payload),
          created_by: actorId,
          updated_by: actorId,
        }));
        await transaction`
          insert into private.registry_parties ${transaction(
            records,
            "tenant_id",
            "party_id",
            "kind",
            "document_digits",
            "name",
            "trade_name",
            "status",
            "roles",
            "payload",
            "created_by",
            "updated_by",
          )}
          on conflict (tenant_id, party_id) do update set
            kind = excluded.kind, document_digits = excluded.document_digits, name = excluded.name,
            status = excluded.status, roles = excluded.roles, payload = excluded.payload,
            updated_by = excluded.updated_by, updated_at = now()
        `;
      }
      for (const part of chunks(parties)) {
        const events = part.map(item => ({
          event_id: `evt-${hash(`${batchId}|${item.party_id}`).slice(0, 32)}`,
          tenant_id: tenantId,
          party_id: item.party_id,
          actor_id: actorId,
          event_type: "CREATED",
          payload: transaction.json({
            origin: sourceSystem,
            batchId,
            document: item.document_digits,
            roles: item.roles,
          }),
        }));
        await transaction`
          insert into private.registry_party_events ${transaction(
            events,
            "event_id",
            "tenant_id",
            "party_id",
            "actor_id",
            "event_type",
            "payload",
          )}
          on conflict (event_id) do nothing
        `;
      }
      for (const part of chunks(sourceRefs))
        await transaction`
          insert into private.party_source_refs ${transaction(
            part,
            "tenant_id",
            "source_system",
            "source_role",
            "external_code",
            "party_id",
            "source_status",
            "raw_name",
            "import_batch_id",
          )}
          on conflict (tenant_id, source_system, source_role, external_code) do update set
            party_id = excluded.party_id, source_status = excluded.source_status, raw_name = excluded.raw_name,
            import_batch_id = excluded.import_batch_id
        `;
      for (const part of chunks(roleStates))
        await transaction`
          insert into private.party_role_states ${transaction(
            part,
            "tenant_id",
            "party_id",
            "role",
            "source_status",
            "normalized_status",
            "import_batch_id",
          )}
          on conflict (tenant_id, party_id, role) do update set
            source_status = excluded.source_status, normalized_status = excluded.normalized_status,
            import_batch_id = excluded.import_batch_id, updated_at = now()
        `;
      for (const part of chunks(titles)) {
        const records = part.map(item => ({
          ...item,
          payload: transaction.json(item.payload),
          created_by: actorId,
          updated_by: actorId,
        }));
        await transaction`
          insert into private.portfolio_titles ${transaction(
            records,
            "tenant_id",
            "title_id",
            "canonical_key",
            "cedent_party_id",
            "debtor_party_id",
            "source_cedent_code",
            "source_debtor_code",
            "document_number",
            "source_sequence",
            "receivable_type",
            "negotiation_date",
            "original_due_date",
            "current_due_date",
            "original_amount",
            "wallet_code",
            "internal_wallet",
            "economic_group",
            "payload",
            "created_by",
            "updated_by",
          )}
          on conflict (tenant_id, title_id) do nothing
        `;
      }
      for (const part of chunks(positions)) {
        const records = part.map(item => ({ ...item, payload: transaction.json(item.payload) }));
        await transaction`
          insert into private.portfolio_title_positions ${transaction(
            records,
            "tenant_id",
            "import_batch_id",
            "title_id",
            "position_date",
            "source_status",
            "lifecycle_status",
            "open_amount",
            "present_amount",
            "paid_amount",
            "discount_amount",
            "discount_income",
            "late_fee_amount",
            "monetary_correction_amount",
            "source_delay_days",
            "computed_days_past_due",
            "collection_agreement",
            "collection_status",
            "score",
            "liquidation_date",
            "payload",
          )}
        `;
      }
      for (const part of chunks(qualityIssues)) {
        const records = part.map(item => ({ ...item, details: transaction.json(item.details) }));
        await transaction`
          insert into private.data_quality_issues ${transaction(
            records,
            "tenant_id",
            "issue_id",
            "import_batch_id",
            "entity_type",
            "entity_id",
            "issue_code",
            "severity",
            "status",
            "details",
          )}
          on conflict (tenant_id, issue_id) do nothing
        `;
      }
      const eventId = `evt-${hash(`${batchId}|completed`).slice(0, 32)}`;
      await transaction`
        insert into private.domain_events
          (tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version, event_type,
           actor_id, correlation_id, payload)
        values (${tenantId}, ${eventId}, 'ImportBatch', ${batchId}, 1, 'PORTFOLIO_SNAPSHOT_IMPORTED',
          ${actorId}, ${batchId}, ${transaction.json({ positionDate, ...controlTotals })})
        on conflict do nothing
      `;
      const verification = await transaction`
        select
          count(*)::integer as title_count,
          coalesce(sum(t.original_amount), 0)::text as face_amount,
          coalesce(sum(p.open_amount), 0)::text as open_amount
        from private.portfolio_title_positions p
        join private.portfolio_titles t
          on t.tenant_id = p.tenant_id and t.title_id = p.title_id
        where p.tenant_id = ${tenantId} and p.import_batch_id = ${batchId}
      `;
      const verified = verification[0];
      if (
        verified.title_count !== titles.length ||
        databaseCents(verified.face_amount) !== faceTotal ||
        databaseCents(verified.open_amount) !== openTotal
      )
        throw new Error(`Reconciliação falhou: ${JSON.stringify(verified)}`);
      const resultCounts = {
        parties: parties.length,
        sourceRefs: sourceRefs.length,
        titles: verified.title_count,
        positions: verified.title_count,
        qualityIssues: qualityIssues.length,
        faceAmount: verified.face_amount,
        openAmount: verified.open_amount,
      };
      await transaction`
        update private.import_batches
        set status = 'COMPLETED', result_counts = ${transaction.json(resultCounts)}, completed_at = now()
        where tenant_id = ${tenantId} and batch_id = ${batchId}
      `;
      return { batchId, positionDate, status: "COMPLETED", result: resultCounts };
    });
    console.log(JSON.stringify(result));
  }
} finally {
  await sql.end();
}
