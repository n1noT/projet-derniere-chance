const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

// Retourne le nom d'onglet correctement quoté pour la notation A1 (ex: "Mes Films" → "'Mes Films'")
function a1Range(sheetName, cols) {
  const quoted = /[ ']/.test(sheetName)
    ? `'${sheetName.replace(/'/g, "''")}'`
    : sheetName;
  return `${quoted}!${cols}`;
}

async function appendRow(spreadsheetId, sheetName, row, token) {
  const range = a1Range(sheetName, 'A:G');
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur HTTP ${res.status}`);
  }
}

async function updateRow(spreadsheetId, sheetName, rowNumber, row, token) {
  const range = a1Range(sheetName, `A${rowNumber}:G${rowNumber}`);
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur HTTP ${res.status}`);
  }
}

async function getSheetId(spreadsheetId, sheetName, token) {
  const url = `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur HTTP ${res.status}`);
  }
  const data = await res.json();
  const sheet = data.sheets?.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Onglet "${sheetName}" introuvable dans le spreadsheet`);
  return sheet.properties.sheetId;
}

async function sortByExpiration(spreadsheetId, sheetId, token) {
  const url = `${SHEETS_API}/${spreadsheetId}:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        sortRange: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: 0 },
          sortSpecs: [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }],
        },
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur tri ${res.status}`);
  }
}

// Colonnes : A=Expiration B=Film C=Genre D=Réalisateur E=Durée F=DD G=Lien
async function findExistingRow(spreadsheetId, sheetName, token, title, director) {
  const range = a1Range(sheetName, 'A:G');
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur HTTP ${res.status}`);
  }
  const data = await res.json();
  const rows = data.values || [];

  const norm = (s) => (s || '').trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (norm(row[1]) === norm(title) && norm(row[3]) === norm(director)) {
      return { sheetRowNumber: i + 1, expiryDate: row[0] || '' };
    }
  }
  return null;
}

const MONTHS = { janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11 };

function parseDate(str) {
  if (!str) return null;

  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);

  const m2 = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m2) {
    const now = new Date();
    const d = new Date(now.getFullYear(), +m2[2] - 1, +m2[1]);
    if (d < now) d.setFullYear(now.getFullYear() + 1);
    return d;
  }

  const m3 = str.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i);
  if (m3 && MONTHS[m3[2].toLowerCase()] !== undefined)
    return new Date(+m3[3], MONTHS[m3[2].toLowerCase()], +m3[1]);

  const m4 = str.match(/^(\d{1,2})\s+(\w+)$/i);
  if (m4 && MONTHS[m4[2].toLowerCase()] !== undefined) {
    const now = new Date();
    const d = new Date(now.getFullYear(), MONTHS[m4[2].toLowerCase()], +m4[1]);
    if (d < now) d.setFullYear(now.getFullYear() + 1);
    return d;
  }

  return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action !== 'saveToSheets') return;

  const { spreadsheetId, sheetName, data } = msg;

  // Colonnes : Expiration | Film | Genre | Réalisateur | Durée (min) | DD | Lien
  const row = [
    data.expiryDate,
    data.title,
    data.genre,
    data.director,
    data.duration,
    !!data.dd,
    data.url,
  ];

  (async () => {
    const token = await getAuthToken();
    const existing = await findExistingRow(spreadsheetId, sheetName, token, data.title, data.director);

    if (existing) {
      const existingDate = parseDate(existing.expiryDate);
      const newDate = parseDate(data.expiryDate);

      // Si l'une des dates est illisible ou si la nouvelle est plus lointaine → mise à jour
      if (!existingDate || !newDate || newDate > existingDate) {
        await updateRow(spreadsheetId, sheetName, existing.sheetRowNumber, row, token);
        sendResponse({ ok: true, updated: true });
      } else {
        sendResponse({ ok: false, exists: true });
        return;
      }
    } else {
      await appendRow(spreadsheetId, sheetName, row, token);
      sendResponse({ ok: true });
    }

    const sheetId = await getSheetId(spreadsheetId, sheetName, token);
    await sortByExpiration(spreadsheetId, sheetId, token);
  })().catch((e) => sendResponse({ ok: false, error: e.message }));

  return true;
});
