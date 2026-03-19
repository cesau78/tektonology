/**
 * CSV parsing and serialization helpers, plus Express middleware
 * for content-type negotiation (text/csv ↔ application/json).
 */

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/** Parse a CSV string into an array of objects keyed by header row. */
export function parseCsv(text) {
  const rows = [];
  let i = 0;
  while (i < text.length) {
    const row = [];
    while (i < text.length) {
      if (text[i] === '"') {
        i++; // skip opening quote
        let field = "";
        while (i < text.length) {
          if (text[i] === '"') {
            if (i + 1 < text.length && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i];
            i++;
          }
        }
        row.push(field);
      } else {
        let field = "";
        while (i < text.length && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
          field += text[i];
          i++;
        }
        row.push(field);
      }
      if (i < text.length && text[i] === ",") {
        i++;
      } else {
        break;
      }
    }
    while (i < text.length && (text[i] === "\r" || text[i] === "\n")) i++;
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0];
  const data = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0] || row[0].trim() === "") continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (row[c] ?? "").trim();
    }
    data.push(obj);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/** Escape a value for CSV output (quote if it contains comma, quote, or newline). */
function escapeField(val) {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Convert an array of objects to a CSV string. */
export function toCsv(docs) {
  if (docs.length === 0) return "";
  const keys = Object.keys(docs[0]).filter((k) => k !== "_id");
  const header = keys.map(escapeField).join(",");
  const rows = docs.map((doc) => keys.map((k) => escapeField(doc[k])).join(","));
  return header + "\n" + rows.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Express middleware — raw text/csv body parser
// ---------------------------------------------------------------------------

/** Parse incoming text/csv request bodies into req.body (string). */
export function csvBodyParser(req, res, next) {
  if (req.headers["content-type"] !== "text/csv") return next();
  let body = "";
  req.setEncoding("utf-8");
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    req.body = body;
    next();
  });
}

// ---------------------------------------------------------------------------
// Content negotiation helper
// ---------------------------------------------------------------------------

/**
 * Respond with JSON or CSV based on the request Accept header.
 * Defaults to JSON when no preference is stated.
 */
export function negotiate(req, res, docs, csvFilename) {
  if (req.accepts(["json", "text/csv"]) === "text/csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${csvFilename}"`);
    return res.send(toCsv(docs));
  }
  res.json(docs);
}
