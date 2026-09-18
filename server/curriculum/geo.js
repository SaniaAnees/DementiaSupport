/**
 * NER hometown / district → Seven Sister state resolver.
 * Free-text caregiver input normalized and matched against aliases.
 */

const STATE_META = {
  as: { code: 'as', name: 'Assam', languageHint: 'as-IN' },
  ml: { code: 'ml', name: 'Meghalaya', languageHint: 'en-IN' },
  mn: { code: 'mn', name: 'Manipur', languageHint: 'mni-IN' },
  nl: { code: 'nl', name: 'Nagaland', languageHint: 'en-IN' },
  mz: { code: 'mz', name: 'Mizoram', languageHint: 'en-IN' },
  tr: { code: 'tr', name: 'Tripura', languageHint: 'bn-IN' },
  ar: { code: 'ar', name: 'Arunachal Pradesh', languageHint: 'en-IN' },
};

/** Longer / more specific aliases first after sort by length. */
const ALIASES = [
  // Assam
  ['guwahati', 'as'], ['gauhati', 'as'], ['dispur', 'as'], ['jorhat', 'as'],
  ['dibrugarh', 'as'], ['tezpur', 'as'], ['silchar', 'as'], ['nagaon', 'as'],
  ['sivasagar', 'as'], ['sibsagar', 'as'], ['tinsukia', 'as'], ['majuli', 'as'],
  ['barpeta', 'as'], ['nalbari', 'as'], ['goalpara', 'as'], ['dhubri', 'as'],
  ['kokrajhar', 'as'], ['lakhimpur', 'as'], ['north lakhimpur', 'as'],
  ['golaghat', 'as'], ['morigaon', 'as'], ['hailakandi', 'as'], ['karimganj', 'as'],
  ['cachar', 'as'], ['kamrup', 'as'], ['sonitpur', 'as'], ['biswanath', 'as'],
  ['hojai', 'as'], ['udalguri', 'as'], ['dhemaji', 'as'], ['charaideo', 'as'],
  ['karbi anglong', 'as'], ['dima hasao', 'as'], ['bongaigaon', 'as'],
  ['assam', 'as'],
  // Meghalaya
  ['shillong', 'ml'], ['cherrapunji', 'ml'], ['sohra', 'ml'], ['mawsynram', 'ml'],
  ['tura', 'ml'], ['jowai', 'ml'], ['nongpoh', 'ml'], ['williamnagar', 'ml'],
  ['east khasi hills', 'ml'], ['west khasi hills', 'ml'], ['garo hills', 'ml'],
  ['jaintia', 'ml'], ['meghalaya', 'ml'],
  // Manipur
  ['imphal', 'mn'], ['imphal east', 'mn'], ['imphal west', 'mn'],
  ['thoubal', 'mn'], ['bishnupur', 'mn'], ['churachandpur', 'mn'],
  ['ukhrul', 'mn'], ['moreh', 'mn'], ['kakching', 'mn'], ['senapati', 'mn'],
  ['manipur', 'mn'],
  // Nagaland
  ['kohima', 'nl'], ['dimapur', 'nl'], ['mokokchung', 'nl'], ['tuensang', 'nl'],
  ['wokha', 'nl'], ['zunheboto', 'nl'], ['mon', 'nl'], ['phek', 'nl'],
  ['nagaland', 'nl'],
  // Mizoram
  ['aizawl', 'mz'], ['lunglei', 'mz'], ['champhai', 'mz'], ['serchhip', 'mz'],
  ['kolasib', 'mz'], ['mamit', 'mz'], ['mizoram', 'mz'],
  // Tripura
  ['agartala', 'tr'], ['udaipur', 'tr'], ['dharmanagar', 'tr'],
  ['kailashahar', 'tr'], ['belonia', 'tr'], ['ambassa', 'tr'], ['tripura', 'tr'],
  // Arunachal
  ['itanagar', 'ar'], ['tawang', 'ar'], ['ziro', 'ar'], ['pasighat', 'ar'],
  ['bomdila', 'ar'], ['tezu', 'ar'], ['roing', 'ar'], ['along', 'ar'],
  ['naharlagun', 'ar'], ['arunachal', 'ar'], ['arunachal pradesh', 'ar'],
];

function normalizePlace(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} hometown
 * @param {string} [explicitState] optional state code or name override
 * @returns {{ code: string, name: string, languageHint: string, matchedAlias: string|null } | null}
 */
function resolveRegion(hometown, explicitState) {
  if (explicitState) {
    const key = normalizePlace(explicitState);
    if (STATE_META[key]) return { ...STATE_META[key], matchedAlias: key };
    for (const meta of Object.values(STATE_META)) {
      if (normalizePlace(meta.name) === key) {
        return { ...meta, matchedAlias: key };
      }
    }
  }

  const place = normalizePlace(hometown);
  if (!place) return null;

  const sorted = [...ALIASES].sort((a, b) => b[0].length - a[0].length);
  for (const [alias, code] of sorted) {
    if (place === alias || place.includes(alias) || alias.includes(place)) {
      return { ...STATE_META[code], matchedAlias: alias };
    }
  }
  return null;
}

function listStates() {
  return Object.values(STATE_META);
}

module.exports = { resolveRegion, listStates, STATE_META, normalizePlace };
