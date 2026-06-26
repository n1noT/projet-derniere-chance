(function () {
  'use strict';

  let hodorToken = null;
  let hodorHeaders = {};
  let cachedData = null;
  let cachedUrl = null;

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data?.type) return;

    if (event.data.type === 'CANAL_HODOR_TOKEN') {
      hodorToken = event.data.token;
      hodorHeaders = event.data.headers ?? {};
    }

    if (event.data.type === 'CANAL_MORE_INFOS') {
      cachedData = parseMoreInfos(event.data.data);
      cachedUrl = window.location.href;
    }
  });

  function parseMoreInfos(json) {
    const core = json.strates?.find(s => s.type === 'coreInformation') ?? {};
    const castingStrate = json.strates?.find(s => s.editorialType === 'casting');
    const directorGroup = castingStrate?.contents?.find(c => c.role === 'director');
    const director = directorGroup?.labels?.[0]?.title ?? '';

    const editorialTitle = core.editorialTitle ?? '';
    const durH = editorialTitle.match(/(\d+)h(\d{2})/);
    const durM = editorialTitle.match(/(\d+)\s*min/i);
    let duration = '';
    if (durH) {
      duration = String(parseInt(durH[1]) * 60 + parseInt(durH[2]));
    } else if (durM) {
      duration = durM[1];
    }

    // "Film Drame   1h50   1951" → tout ce qui précède la durée → retirer le préfixe de type
    const beforeDuration = editorialTitle.replace(/\s*\d+h\d*.*$/i, '').trim();
    const genre = beforeDuration.replace(/^(?:Film|Série|Documentaire|Téléfilm)\s+/i, '').trim()
      || (json.tracking?.dataLayer?.subgenre ?? '').replace(/^(?:Film|Série|Documentaire|Téléfilm)\s+/i, '').trim();

    const expiryRaw = core.availabilityEndDateLabel ?? '';
    let expiryDate;
    const monthsMatch = expiryRaw.match(/plus de (\d+) mois/i);
    const dayNames = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0 };
    const foundDay = Object.keys(dayNames).find(d => new RegExp(`\\b${d}\\b`, 'i').test(expiryRaw));

    if (monthsMatch) {
      const d = new Date();
      d.setMonth(d.getMonth() + parseInt(monthsMatch[1]));
      expiryDate = d.toLocaleDateString('fr-FR');
    } else if (foundDay) {
      const d = new Date();
      const diff = (dayNames[foundDay] - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + diff);
      expiryDate = d.toLocaleDateString('fr-FR');
    } else {
      expiryDate = expiryRaw.replace(/disponible jusqu.{0,3}au\s*/i, '').trim();
    }

    return { title: core.title ?? '', genre, duration, director, expiryDate };
  }

  function waitForToken(timeout = 3000) {
    if (hodorToken) return Promise.resolve(hodorToken);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, timeout);
      const handler = (event) => {
        if (event.source === window && event.data?.type === 'CANAL_HODOR_TOKEN') {
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve(event.data.token);
        }
      };
      window.addEventListener('message', handler);
    });
  }

  async function fetchMoreInfos() {
    const token = await waitForToken();
    if (!token) return null;

    const idMatch = window.location.pathname.match(/\/h\/([^/]+)/);
    if (!idMatch) return null;
    const contentId = idMatch[1];

    const url = `https://hodor.canalplus.pro/api/v2/mycanal/moreInfos/${token}/${contentId}?objectType=unit&adult=false&dsp=detailPage`;

    try {
      const res = await fetch(url, { headers: hodorHeaders });
      if (!res.ok) return null;
      const data = await res.json();
      return parseMoreInfos(data);
    } catch {
      return null;
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action !== 'extractData') return;

    const base = { platform: 'CANAL+', url: window.location.href };
    const empty = { title: '', genre: '', duration: '', director: '', expiryDate: '' };

    if (cachedData && cachedUrl === window.location.href) {
      sendResponse({ ...base, ...cachedData });
      return;
    }
    cachedData = null;

    fetchMoreInfos().then(data => {
      if (data) {
        cachedData = data;
        cachedUrl = window.location.href;
      }
      sendResponse({ ...base, ...(data ?? empty) });
    });

    return true;
  });
})();
