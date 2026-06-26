'use strict';

const $ = (id) => document.getElementById(id);

async function loadConfig() {
  return chrome.storage.sync.get({ spreadsheetId: '', sheetName: 'Films' });
}

function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.className = isError ? 'error' : '';
}

function populateForm(data) {
  $('title').value = data.title || '';
  $('genre').value = data.genre || '';
  $('duration').value = data.duration || '';
  $('director').value = data.director || '';
  $('expiry').value = data.expiryDate || '';
}

function getFormData() {
  return {
    title: $('title').value.trim(),
    genre: $('genre').value.trim(),
    duration: $('duration').value.trim(),
    director: $('director').value.trim(),
    expiryDate: $('expiry').value.trim(),
    dd: $('dd').checked,
  };
}

function showUnsupported() {
  $('main').style.display = 'none';
  $('unsupported').style.display = 'block';
  $('save-btn') && ($('save-btn').disabled = true);
}

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';

  if (!url.includes('canalplus.com')) {
    showUnsupported();
    return;
  }

  $('platform-badge').textContent = 'CANAL+';

  const { spreadsheetId, sheetName } = await loadConfig();
  $('cfg-sheet-id').value = spreadsheetId;
  $('cfg-sheet-name').value = sheetName;

  if (!spreadsheetId) {
    setStatus('Configurez votre Spreadsheet dans ⚙ Paramètres', true);
  }

  try {
    const data = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
    data.url = url;
    populateForm(data);
    if (!data.title) setStatus('Aucune donnée détectée — remplissez manuellement');
  } catch {
    setStatus('Erreur extraction — remplissez manuellement');
  }

  $('save-btn').addEventListener('click', async () => {
    const cfg = await loadConfig();

    if (!cfg.spreadsheetId) {
      setStatus('Spreadsheet ID manquant dans les paramètres', true);
      return;
    }

    const formData = getFormData();
    if (!formData.title) {
      setStatus('Le titre est obligatoire', true);
      return;
    }

    $('save-btn').disabled = true;
    setStatus('Enregistrement…');

    // Re-query l'URL au moment du clic pour éviter une URL périmée (SPA)
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = currentTab?.url || '';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveToSheets',
        spreadsheetId: cfg.spreadsheetId,
        sheetName: cfg.sheetName,
        data: { ...formData, url: currentUrl },
      });

      if (response.ok) {
        setStatus(response.updated ? '✓ Date mise à jour !' : '✓ Ajouté avec succès !');
        setTimeout(() => window.close(), 1200);
      } else if (response.exists) {
        setStatus('Déjà dans la liste avec une date plus longue', true);
        $('save-btn').disabled = false;
      } else {
        setStatus(response.error || 'Erreur inconnue', true);
        $('save-btn').disabled = false;
      }
    } catch {
      setStatus('Impossible de contacter l\'extension — réessayez', true);
      $('save-btn').disabled = false;
    }
  });

  $('settings-toggle').addEventListener('click', () => {
    $('settings-panel').classList.toggle('open');
  });

  $('settings-save').addEventListener('click', async () => {
    const id = $('cfg-sheet-id').value.trim();
    const name = $('cfg-sheet-name').value.trim() || 'Films';
    await chrome.storage.sync.set({ spreadsheetId: id, sheetName: name });
    $('settings-panel').classList.remove('open');
    setStatus('Paramètres sauvegardés');
    if (id) setTimeout(() => setStatus(''), 2000);
  });
});
