(function () {
  'use strict';

  const original = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input?.url ?? '');
    const isHodor = url.includes('hodor.canalplus.pro');

    const response = await original(input, init);

    if (isHodor) {
      const tokenMatch = url.match(/\/mycanal\/\w+\/([a-f0-9]{32})\//);
      if (tokenMatch) {
        const token = tokenMatch[1];
        const raw = init?.headers ?? {};
        const headers = {};
        if (raw instanceof Headers) {
          raw.forEach((v, k) => { headers[k] = v; });
        } else if (Array.isArray(raw)) {
          raw.forEach(([k, v]) => { headers[k] = v; });
        } else {
          Object.assign(headers, raw);
        }
        window.postMessage({ type: 'CANAL_HODOR_TOKEN', token, headers }, '*');
      }

      // Indépendant du tokenMatch : capture moreInfos quelle que soit la structure d'URL
      if (url.includes('/moreInfos/')) {
        response.clone().json().then(data => {
          window.postMessage({ type: 'CANAL_MORE_INFOS', data }, '*');
        }).catch(() => {});
      }
    }

    return response;
  };
})();
