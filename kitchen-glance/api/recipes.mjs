const service = 'COOKRCP01';
const endpoint = 'https://openapi.foodsafetykorea.go.kr/api/';
const imageHosts = new Set(['www.foodsafetykorea.go.kr', 'foodsafetykorea.go.kr', 'openapi.foodsafetykorea.go.kr']);
const aliases = new Map([
  ['계란', '달걀'],
  ['참치캔', '참치'],
  ['파스타면', '파스타'],
]);
const successCache = {'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200'};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function imageUrl(value) {
  try {
    const url = new URL(value);
    if (!imageHosts.has(url.hostname) || !['http:', 'https:'].includes(url.protocol)) return '';
    url.protocol = 'https:';
    return url.href;
  } catch {
    return '';
  }
}

function normalize(row) {
  const steps = Array.from({length: 20}, (_, index) => {
    const key = String(index + 1).padStart(2, '0');
    return text(row['MANUAL' + key]).replace(/^\d+[.)]\s*/, '');
  }).filter(Boolean);
  return {
    name: text(row.RCP_NM),
    category: text(row.RCP_PAT2),
    ingredients: text(row.RCP_PARTS_DTLS),
    image: imageUrl(row.ATT_FILE_NO_MAIN) || imageUrl(row.ATT_FILE_NO_MK),
    steps,
  };
}

export async function GET(request) {
  const input = new URL(request.url).searchParams.get('ingredient')?.normalize('NFC').trim().replace(/ +/g, ' ') ?? '';
  if (!/^[가-힣]+(?: [가-힣]+)*$/.test(input) || input.replace(/ /g, '').length > 10) {
    return Response.json({error: 'invalid_ingredient'}, {status: 400});
  }

  const key = process.env.FOODSAFETY_API_KEY?.trim();
  if (!key) return Response.json({error: 'source_not_configured'}, {status: 503});

  try {
    const ingredient = aliases.get(input) ?? input;
    const url = endpoint + [key, service, 'json', '1', '9'].map(encodeURIComponent).join('/')
      + '/RCP_PARTS_DTLS=' + encodeURIComponent(ingredient);
    const response = await fetch(url, {signal: AbortSignal.timeout(7000), redirect: 'error'});
    if (!response.ok) throw new Error('Upstream request failed');
    const payload = await response.json();
    const data = payload[service];
    const result = data?.RESULT ?? payload.RESULT;
    if (result?.CODE === 'INFO-200') return Response.json({recipes: []}, {headers: successCache});
    if (result?.CODE !== 'INFO-000' || !Array.isArray(data?.row)) throw new Error('Unexpected upstream result');

    const recipes = data.row.filter(row => row && typeof row === 'object')
      .map(normalize).filter(recipe => recipe.name && (recipe.ingredients || recipe.steps.length));
    return Response.json({recipes}, {headers: successCache});
  } catch {
    return Response.json({error: 'source_unavailable'}, {status: 502});
  }
}
